import { randomUUID } from 'crypto';
import { canSeeChat } from '../shared/mentions';
import { MAX_PLAYERS, PlayerInfo, RoomChatMessage } from '../shared/protocol';

const MAX_CHAT = 100;

/** Returns trimmed chat text, or null when it should be dropped. */
export function normalizeChatText(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  return trimmed;
}

/**
 * Pure roster/slot/cabin bookkeeping for the relay. No socket knowledge —
 * server/relay.ts owns the actual WebSocket connections and calls into this.
 *
 * The first connection to join becomes host. Cabins are optional at join time:
 * a 3D office may still be loading, or the host browser may have no WebGPU.
 * The first client that has a loaded office may publish cabin ids; later
 * joiners are not turned away while that list is empty.
 */
export class RoomState {
  private players = new Map<string, PlayerInfo>();
  private cabinPoiIds: string[] | null = null;
  private hostId: string | null = null;
  /** Survives the host disconnecting so a refresh can reclaim the seat. A display name never matches this. */
  private hostPlayerId: string | null = null;
  private hostToken: string | null = null;
  private chat: RoomChatMessage[] = [];

  public cabinsReady(): boolean {
    return this.cabinPoiIds !== null;
  }

  public isHost(id: string): boolean {
    return this.hostId === id;
  }

  private nextFreeSlot(): number | null {
    const used = new Set(Array.from(this.players.values()).map((p) => p.slotIndex));
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!used.has(i)) return i;
    }
    return null;
  }

  private nextFreeCabin(): string | null {
    if (!this.cabinPoiIds) return null;
    const used = new Set(Array.from(this.players.values()).map((p) => p.cabinPoiId));
    for (const id of this.cabinPoiIds) {
      if (!used.has(id)) return id;
    }
    return null;
  }

  /** True when this browser may take the id back. The host id also needs the host token. */
  public canResume(id: string, token?: string): boolean {
    if (this.players.has(id)) return false;
    if (id === this.hostPlayerId) return !!this.hostToken && token === this.hostToken;
    return true;
  }

  public join(
    id: string,
    name: string,
    color: string,
    token?: string
  ): { ok: true; info: PlayerInfo; hostToken?: string } | { ok: false; reason: 'room-full' } {
    const slotIndex = this.nextFreeSlot();
    if (slotIndex === null) {
      return { ok: false, reason: 'room-full' };
    }

    const roomEmpty = this.players.size === 0;
    if (roomEmpty) {
      this.hostToken = randomUUID();
      this.hostPlayerId = id;
      this.hostId = null;
    }
    const isHost = roomEmpty || (!!this.hostToken && token === this.hostToken && id === this.hostPlayerId);

    const info: PlayerInfo = {
      id,
      name,
      color,
      slotIndex,
      cabinPoiId: this.nextFreeCabin(),
      isHost,
    };
    this.players.set(id, info);
    if (isHost) this.hostId = id;
    return { ok: true, info, hostToken: isHost ? this.hostToken ?? undefined : undefined };
  }

  /** First loaded office publishes cabins. The host may replace that list later. */
  public registerCabins(id: string, cabinPoiIds: string[]): PlayerInfo[] | null {
    if (!this.players.has(id)) return null;
    if (!cabinPoiIds.length) return null;
    if (this.cabinPoiIds && id !== this.hostId) return null;
    this.cabinPoiIds = cabinPoiIds;
    // Backfill the host's own cabin — it joined before any cabins existed.
    for (const player of this.players.values()) {
      if (player.cabinPoiId === null) {
        player.cabinPoiId = this.nextFreeCabin();
      }
    }
    return this.getRoster();
  }

  public leave(id: string): void {
    const wasHost = this.hostId === id;
    this.players.delete(id);
    if (wasHost) {
      this.hostId = null;
      this.cabinPoiIds = null;
    }
    if (this.players.size === 0) {
      this.hostId = null;
      this.hostPlayerId = null;
      this.hostToken = null;
      this.cabinPoiIds = null;
    }
  }

  public getRoster(): PlayerInfo[] {
    return Array.from(this.players.values());
  }

  public addChat(message: RoomChatMessage): RoomChatMessage[] {
    this.chat.push(message);
    if (this.chat.length > MAX_CHAT) this.chat.splice(0, this.chat.length - MAX_CHAT);
    return this.chat;
  }

  public getChat(): RoomChatMessage[] {
    return this.chat;
  }

  public chatFor(playerId: string): RoomChatMessage[] {
    return this.chat.filter((message) => canSeeChat(message, playerId));
  }
}
