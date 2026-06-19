import { randomUUID } from 'crypto';
import type { Server as HttpServer } from 'http';
import type { Plugin, ViteDevServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientMessage, ServerMessage } from '../shared/protocol';
import { RoomState } from './roomState';

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Vite plugin attaching a plain WebSocket relay to the same dev-server port/process.
 * Uses a distinct path so it never intercepts Vite's own HMR WebSocket traffic.
 */
export function relayPlugin(): Plugin {
  let wss: WebSocketServer | null = null;

  return {
    name: 'the-delegation-relay',
    configureServer(server: ViteDevServer) {
      if (!server.httpServer) {
        console.warn('[relay] No httpServer (middleware mode?) — relay disabled.');
        return;
      }

      const room = new RoomState();
      const sockets = new Map<string, WebSocket>();

      const broadcastAll = (msg: ServerMessage): void => {
        for (const ws of sockets.values()) send(ws, msg);
      };

      const broadcastExcept = (excludeId: string, msg: ServerMessage): void => {
        for (const [id, ws] of sockets) {
          if (id !== excludeId) send(ws, msg);
        }
      };

      // Vite's dev server only runs HTTP/1 unless HTTP/2 is explicitly configured (not the case here),
      // so this is always a plain http.Server — narrow past the Http2SecureServer union member ws lacks types for.
      wss = new WebSocketServer({ server: server.httpServer as HttpServer, path: '/__relay' });

      wss.on('connection', (ws) => {
        let playerId: string | null = null;

        ws.on('message', (raw) => {
          let msg: ClientMessage;
          try {
            msg = JSON.parse(raw.toString());
          } catch {
            return;
          }

          switch (msg.type) {
            case 'join': {
              if (playerId) return;
              const id = randomUUID();
              const result = room.join(id, msg.name, msg.color);
              if (!result.ok) {
                // Guarded as the failure variant; named explicitly so the non-strict
                // root tsconfig (which also type-checks this file via vite.config) narrows it.
                const { reason } = result as { ok: false; reason: 'room-full' | 'cabins-not-ready' };
                send(ws, { type: reason });
                ws.close();
                return;
              }
              playerId = id;
              sockets.set(id, ws);
              send(ws, { type: 'joined', me: result.info, roster: room.getRoster() });
              broadcastExcept(id, { type: 'roster-update', roster: room.getRoster() });
              break;
            }
            case 'register-cabins': {
              if (!playerId) return;
              const roster = room.registerCabins(playerId, msg.cabinPoiIds);
              if (roster) broadcastAll({ type: 'roster-update', roster });
              break;
            }
            case 'player-state': {
              if (!playerId) return;
              broadcastExcept(playerId, {
                type: 'player-state',
                playerId,
                pos: msg.pos,
                vel: msg.vel,
                animState: msg.animState,
                speaking: msg.speaking,
              });
              break;
            }
            case 'npc-state': {
              if (!playerId || !room.isHost(playerId)) return;
              broadcastExcept(playerId, { type: 'npc-state', npcs: msg.npcs });
              break;
            }
            case 'leave': {
              ws.close();
              break;
            }
          }
        });

        ws.on('close', () => {
          if (!playerId) return;
          room.leave(playerId);
          sockets.delete(playerId);
          broadcastAll({ type: 'player-left', playerId });
          broadcastAll({ type: 'roster-update', roster: room.getRoster() });
          playerId = null;
        });
      });

      server.httpServer.once('close', () => {
        wss?.close();
        wss = null;
      });
    },
  };
}
