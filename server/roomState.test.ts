import { describe, expect, it } from 'vitest';
import { normalizeChatText, RoomState } from './roomState';

describe('public room chat', () => {
  it('drops empty and oversized messages', () => {
    expect(normalizeChatText('  hello  ')).toBe('hello');
    expect(normalizeChatText('   ')).toBeNull();
    expect(normalizeChatText('x'.repeat(2001))).toBeNull();
  });

  it('lets the next person in before the 3D office has cabins', () => {
    const room = new RoomState();
    const host = room.join('h', 'Host', '#111');
    const guest = room.join('g', 'Guest', '#222');
    expect(host.ok).toBe(true);
    expect(guest.ok).toBe(true);
    expect(room.registerCabins('g', ['cabin-a', 'cabin-b'])?.map((p) => p.cabinPoiId)).toEqual(['cabin-a', 'cabin-b']);
  });

  it('keeps the latest 100 messages', () => {
    const room = new RoomState();
    for (let i = 0; i < 105; i++) {
      room.addChat({ id: String(i), playerId: 'p', name: 'A', text: String(i), timestamp: i });
    }
    const chat = room.getChat();
    expect(chat).toHaveLength(100);
    expect(chat[0].id).toBe('5');
    expect(chat[99].id).toBe('104');
  });
});
