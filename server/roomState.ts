import { MAX_PLAYERS, PlayerInfo } from '../shared/protocol';

/**
 * Pure roster/slot/cabin bookkeeping for the relay. No socket knowledge —
 * server/relay.ts owns the actual WebSocket connections and calls into this.
 *
 * The first connection to join becomes host. This is a simplification valid
 * for Phase 1: the relay only runs on the host's own laptop, and the host's
 * own browser tab is expected to connect (and register cabins) before the
 * LAN address is shared with anyone else. Host disconnect/migration mid-session
 * is not handled — out of scope for Phase 1.
 */
export class RoomState {
  private players = new Map<string, PlayerInfo>();
  private cabinPoiIds: string[] | null = null;
  private hostId: string | null = null;

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
  ): { ok: true; info: PlayerInfo } | { ok: false; reason: 'room-full' | 'cabins-not-ready' } {
    const isHost = this.hostId === null;
    if (!isHost && !this.cabinsReady()) {
      return { ok: false, reason: 'cabins-not-ready' };
    }

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

  /** Returns the updated roster if registration succeeded (caller is host), else null. */
  public registerCabins(id: string, cabinPoiIds: string[]): PlayerInfo[] | null {
    if (id !== this.hostId) return null;
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
}
