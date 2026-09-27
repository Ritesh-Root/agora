import { ClientMessage, ServerMessage } from '../../shared/protocol';
import { useRosterStore } from './RosterStore';
import { useSocietyStore } from '../integration/store/societyStore';
import { useCoreStore } from '../integration/store/coreStore';
import { useRoomChatStore } from './roomChatStore';
import { useDecisionStore } from '../interface/decisionStore';

const RECONNECT_DELAYS_MS = [1000, 2000, 3000];
const SEAT_KEY = 'agora-room-seat';

function readSeat(): { playerId?: string; hostToken?: string } | null {
  try {
    const raw = sessionStorage.getItem(SEAT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { playerId?: unknown; hostToken?: unknown };
    return {
      playerId: typeof parsed.playerId === 'string' ? parsed.playerId : undefined,
      hostToken: typeof parsed.hostToken === 'string' ? parsed.hostToken : undefined,
    };
  } catch {
    return null;
  }
}

function rememberSeat(playerId: string, hostToken?: string): void {
  try {
    sessionStorage.setItem(SEAT_KEY, JSON.stringify(hostToken ? { playerId, hostToken } : { playerId }));
  } catch {
    // Private mode can reject storage. The room still works for this page load.
  }
}

type MessageHandler = (msg: ServerMessage) => void;

/**
 * Thin WebSocket wrapper around the Vite-attached relay (see server/relay.ts).
 * Owns the socket lifecycle and roster bookkeeping; forwards every message to
 * subscribers via onMessage() so simulation code (SceneManager) can react to
 * player-state/npc-state without this module depending on CharacterController.
 */
export class NetworkClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private handlers = new Set<MessageHandler>();
  private name = '';
  private color = '';
  private manuallyClosed = false;
  /** Set when the relay rejected the join outright (room full). Terminal — suppress auto-reconnect until the user retries. */
  private rejected = false;

  public connect(name: string, color: string): void {
    this.name = name;
    this.color = color;
    this.manuallyClosed = false;
    this.rejected = false;
    this.reconnectAttempts = 0;
    useRosterStore.getState().setStatus('connecting');
    this._open();
  }

  public disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.send({ type: 'leave' });
    this.ws?.close();
    this.ws = null;
    useRosterStore.getState().reset();
  }

  /**
   * Lets a static frontend remain explorable when the optional relay is not
   * available, such as a Vercel-only preview. Live multiplayer is unchanged
   * when the relay connects normally.
   */
  public enterDemoMode(name = this.name || 'Guest', color = this.color || '#6366C9'): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;

    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `demo-${Date.now()}`;
    const me = {
      id,
      name,
      color,
      slotIndex: 0,
      cabinPoiId: null,
      isHost: true,
    };

    this._handleMessage({ type: 'joined', me, roster: [me] });
  }

  public isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Feed a server message through the same stores and listeners as a live socket frame. */
  public ingest(msg: ServerMessage): void {
    this._handleMessage(msg);
  }

  public send(msg: ClientMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  /** Subscribe to every inbound server message. Returns an unsubscribe function. */
  public onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private _open(): void {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${location.hostname}:${location.port}/__relay`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      const seat = readSeat();
      this.send({
        type: 'join',
        name: this.name,
        color: this.color,
        resumeId: seat?.playerId,
        resumeToken: seat?.hostToken,
      });
    };

    ws.onmessage = (event) => {
      this._handleMessage(JSON.parse(event.data));
    };

    ws.onclose = () => {
      if (this.manuallyClosed || this.rejected) return;
      // Keep the explanatory 'cabins-not-ready' label across the retry instead of
      // flashing a generic 'disconnected' — the host is up, just not ready yet.
      if (useRosterStore.getState().status !== 'cabins-not-ready') {
        useRosterStore.getState().setStatus('disconnected');
      }
      this._scheduleReconnect();
    };
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= RECONNECT_DELAYS_MS.length) {
      this.enterDemoMode();
      return;
    }
    const delay = RECONNECT_DELAYS_MS[this.reconnectAttempts];
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      if (this.manuallyClosed) return;
      useRosterStore.getState().setStatus('connecting');
      this._open();
    }, delay);
  }

  private _handleMessage(msg: ServerMessage): void {
    const roster = useRosterStore.getState();
    switch (msg.type) {
      case 'joined':
        this.reconnectAttempts = 0;
        rememberSeat(msg.me.id, msg.hostToken);
        roster.setSelf(msg.me);
        roster.setRoster(msg.roster);
        roster.setStatus('connected');
        break;
      case 'room-full':
        this.rejected = true;
        roster.setStatus('room-full');
        break;
      case 'cabins-not-ready':
        // Host is connected but hasn't published its cabin layout yet. Transient:
        // the imminent socket close triggers a bounded reconnect that retries the join.
        roster.setStatus('cabins-not-ready');
        break;
      case 'roster-update':
        roster.setRoster(msg.roster);
        break;
      case 'room-chat-history':
        useRoomChatStore.getState().setHistory(msg.messages);
        break;
      case 'room-chat':
        useRoomChatStore.getState().add(msg.message);
        break;
      case 'society-started':
        useDecisionStore.getState().reset();
        useCoreStore.getState().startProject(msg.brief);
        useSocietyStore.getState().startSociety(msg.brief);
        break;
      case 'society-decision':
        useDecisionStore.getState().add(msg.decision);
        break;
      case 'decision-request':
        useDecisionStore.getState().setPending({ id: msg.id, ...msg.decision });
        break;
      case 'society-task-update':
        useSocietyStore.getState().updateTask(msg.taskId, {
          title: msg.title,
          role: msg.role,
          status: msg.status,
          output: msg.output,
          attempt: msg.attempt,
          researching: msg.researching ?? false,
        });
        break;
      case 'society-negotiation':
        if (msg.scores) {
          useSocietyStore.getState().setNegotiationScores(msg.topic, msg.scores);
        }
        useSocietyStore.getState().addNegotiationTurn(msg.topic, {
          round: msg.round,
          agent: msg.agent,
          argument: msg.argument
        });
        break;
      case 'society-complete':
        useSocietyStore.getState().setSocietyComplete(msg.result);
        if (msg.result.synthesis?.trim()) {
          useCoreStore.getState().setFinalOutput(msg.result.synthesis);
          useCoreStore.getState().setPhase('done');
        }

        // Populate core store tasks to feed into 3D agent simulation
        for (const t of msg.result.tasks) {
          useCoreStore.getState().addTask({
            title: t.title,
            description: `Collaboratively generated by society role: ${t.role}`,
            assignedAgentId: 2, // Default worker index
            status: t.status === 'done' ? 'done' : 'scheduled',
            requiresUserApproval: false,
            output: t.output
          });
        }
        break;
      case 'society-error':
        useSocietyStore.getState().setSocietyError(msg.error);
        break;
      case 'benchmark-result':
        useSocietyStore.getState().setBenchmarkResult({
          society: msg.society,
          single: msg.single,
          qualityScores: msg.qualityScores
        });
        break;
      default:
        break;
    }
    for (const handler of this.handlers) handler(msg);
  }
}

export const networkClient = new NetworkClient();
