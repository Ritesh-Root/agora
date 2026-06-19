import { ClientMessage, ServerMessage } from '../../shared/protocol';
import { useRosterStore } from './RosterStore';

const RECONNECT_DELAYS_MS = [1000, 2000, 3000];

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

  public send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
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
      this.reconnectAttempts = 0;
      this.send({ type: 'join', name: this.name, color: this.color });
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
      useRosterStore.getState().setStatus('failed');
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
      default:
        break;
    }
    for (const handler of this.handlers) handler(msg);
  }
}

export const networkClient = new NetworkClient();
