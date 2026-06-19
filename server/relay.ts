import { randomUUID } from 'crypto';
import type { WebSocket as WsSocket } from 'ws';
import type { Plugin, ViteDevServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientMessage, ServerMessage } from '../shared/protocol';
import { RoomState } from './roomState';

const RELAY_PATH = '/__relay';

function send(ws: WsSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Vite plugin attaching a plain WebSocket relay to the dev-server process.
 *
 * Uses `noServer: true` and routes the HTTP `upgrade` event by pathname so it
 * ONLY claims `/__relay` and leaves every other upgrade (notably Vite's own HMR
 * socket) untouched. Attaching with `{ server, path }` instead would make `ws`
 * destroy non-matching upgrade sockets and break HMR (endless "connection lost"
 * reloads).
 */
export function relayPlugin(): Plugin {
  let wss: WebSocketServer | null = null;

  return {
    name: 'agora-relay',
    configureServer(server: ViteDevServer) {
      if (!server.httpServer) {
        console.warn('[relay] No httpServer (middleware mode?) — relay disabled.');
        return;
      }

      const room = new RoomState();
      const sockets = new Map<string, WsSocket>();

      const broadcastAll = (msg: ServerMessage): void => {
        for (const ws of sockets.values()) send(ws, msg);
      };

      const broadcastExcept = (excludeId: string, msg: ServerMessage): void => {
        for (const [id, ws] of sockets) {
          if (id !== excludeId) send(ws, msg);
        }
      };

      wss = new WebSocketServer({ noServer: true });

      // Route upgrades by path: claim /__relay, ignore the rest so Vite's HMR works.
      server.httpServer.on('upgrade', (req, socket, head) => {
        let pathname: string;
        try {
          pathname = new URL(req.url ?? '', 'http://localhost').pathname;
        } catch {
          pathname = req.url ?? '';
        }
        if (pathname !== RELAY_PATH) return; // not ours — leave it for Vite/others
        wss!.handleUpgrade(req, socket, head, (ws) => wss!.emit('connection', ws, req));
      });

      wss.on('connection', (ws: WsSocket) => {
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
