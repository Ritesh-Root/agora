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

  public join(
    id: string,
    name: string,
    color: string
  ): { ok: true; info: PlayerInfo } | { ok: false; reason: 'room-full' } {
    const isHost = this.hostId === null;
    const slotIndex = this.nextFreeSlot();
    if (slotIndex === null) {
      return { ok: false, reason: 'room-full' };
    }

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
    return { ok: true, info };
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
    this.players.delete(id);
    if (this.hostId === id) {
      this.hostId = null;
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
}
