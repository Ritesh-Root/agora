import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import type { WebSocket as WsSocket } from 'ws';
import type { Plugin, ViteDevServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientMessage, ServerMessage } from '../shared/protocol';
import { RoomState } from './roomState';
import { runSociety } from './society/Orchestrator';
import { runNegotiation } from './society/Negotiation';
import { runBenchmark } from './bench/runner';
import { createServerProvider } from './society/provider';

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
      // ── Generic CORS Proxy Middleware ──────────────────────────
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/cors-proxy' && req.method === 'POST') {
          const targetUrl = req.headers['x-target-url'] as string;
          if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing X-Target-URL header' }));
            return;
          }

          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
              };
              if (req.headers.authorization) {
                headers['Authorization'] = req.headers.authorization;
              }
              if (req.headers.accept) {
                headers['Accept'] = req.headers.accept as string;
              }

              const response = await fetch(targetUrl, {
                method: 'POST',
                headers,
                body: bodyStr,
              });

              const text = await response.text();
              res.writeHead(response.status, {
                'Content-Type': response.headers.get('content-type') || 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(text);
            } catch (err) {
              console.error('[CORS Proxy Error]:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
            }
          });
          return;
        }

        if (req.url === '/api/cors-proxy' && req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Target-URL',
          });
          res.end();
          return;
        }

        next();
      });

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
            case 'run-society': {
              // Demo/dev replay: when SOCIETY_REPLAY points at a recorded run's
              // message schedule, stream those events instead of running live.
              const societyReplay = process.env.SOCIETY_REPLAY;
              if (societyReplay) {
                try {
                  const sched = JSON.parse(readFileSync(societyReplay, 'utf8'));
                  console.log('[relay] society replay from', societyReplay);
                  for (const entry of sched.schedule) {
                    setTimeout(() => send(ws, entry.msg), entry.at);
                  }
                  break;
                } catch (e) {
                  console.error('[relay] society replay failed, running live:', e);
                }
              }
              // Read key from environment (process.env.DASHSCOPE_API_KEY)
              const apiKey = process.env.DASHSCOPE_API_KEY;
              if (!apiKey) {
                send(ws, { type: 'society-error', error: 'Server DASHSCOPE_API_KEY environment variable is not configured.' });
                break;
              }

              send(ws, { type: 'society-started', brief: msg.brief, taskCount: 0 });

              const provider = createServerProvider(apiKey);
              runSociety(msg.brief, provider, {
                onEvent: (event) => {
                  if (event.type === 'task-start') {
                    send(ws, {
                      type: 'society-task-update',
                      taskId: event.taskId,
                      title: event.title,
                      role: event.role,
                      status: 'running'
                    });
                  } else if (event.type === 'task-healing') {
                    send(ws, {
                      type: 'society-task-update',
                      taskId: event.taskId,
                      title: event.title,
                      role: event.role,
                      status: 'healing',
                      attempt: event.attempt
                    });
                  } else if (event.type === 'task-done') {
                    send(ws, {
                      type: 'society-task-update',
                      taskId: event.taskId,
                      title: event.title,
                      role: event.role,
                      status: event.status === 'done' ? 'done' : 'escalated',
                      output: event.output,
                      attempt: event.attempts
                    });
                  }
                }
              }).then(async (result) => {
                let negotiationRes: any = undefined;

                if (result.tasks.length >= 2) {
                  // Resolve debate on integration between tasks
                  const debateTopic = `Integrate outputs of "${result.tasks[0].title}" and "${result.tasks[1].title}" into a unified outcome for the brief: "${msg.brief}"`;
                  const positions = [
                    { agent: result.tasks[0].title, stance: result.tasks[0].output.slice(0, 500) },
                    { agent: result.tasks[1].title, stance: result.tasks[1].output.slice(0, 500) }
                  ];

                  try {
                    const debateResult = await runNegotiation(debateTopic, positions, provider, {
                      maxRounds: 2,
                      onEvent: (e) => {
                        if (e.type === 'negotiation-turn') {
                          send(ws, {
                            type: 'society-negotiation',
                            topic: debateTopic,
                            round: e.round,
                            agent: e.agent,
                            argument: e.argument
                          });
                        } else if (e.type === 'negotiation-scores') {
                          send(ws, {
                            type: 'society-negotiation',
                            topic: debateTopic,
                            round: e.round,
                            agent: 'Referee',
                            argument: `Scoring results for Round ${e.round}`,
                            scores: e.scores
                          });
                        }
                      }
                    });

                    negotiationRes = {
                      topic: debateTopic,
                      rounds: debateResult.rounds,
                      outcome: debateResult.outcome,
                      winner: debateResult.winner,
                      synthesis: debateResult.synthesis,
                      scores: debateResult.scores,
                      transcript: debateResult.transcript
                    };
                  } catch (e) {
                    console.error('[Relay] Negotiation failed:', e);
                  }
                }

                send(ws, {
                  type: 'society-complete',
                  result: {
                    brief: result.brief,
                    tasks: result.tasks.map(t => ({
                      id: t.id,
                      title: t.title,
                      role: t.role,
                      status: t.status,
                      output: t.output,
                      attempts: t.attempts,
                      healed: t.healed
                    })),
                    negotiation: negotiationRes,
                    metrics: result.metrics
                  }
                });
              }).catch((err) => {
                send(ws, { type: 'society-error', error: err.message || String(err) });
              });
              break;
            }
            case 'run-benchmark': {
              // Demo/dev replay: when BENCH_REPLAY points at a saved benchmark-result
              // JSON (recorded from a real run), stream it back after a short delay
              // instead of re-running the pipelines. Inactive unless the env var is set.
              const replayPath = process.env.BENCH_REPLAY;
              if (replayPath) {
                try {
                  const saved = JSON.parse(readFileSync(replayPath, 'utf8'));
                  console.log('[relay] benchmark replay from', replayPath);
                  setTimeout(() => send(ws, saved), 12_000);
                  break;
                } catch (e) {
                  console.error('[relay] benchmark replay failed, running live:', e);
                }
              }
              const apiKey = process.env.DASHSCOPE_API_KEY;
              if (!apiKey) {
                send(ws, { type: 'society-error', error: 'Server DASHSCOPE_API_KEY environment variable is not configured.' });
                break;
              }

              const provider = createServerProvider(apiKey);
              runBenchmark(msg.brief, provider).then((benchResult) => {
                send(ws, {
                  type: 'benchmark-result',
                  society: {
                    brief: benchResult.society.brief,
                    tasks: benchResult.society.tasks.map(t => ({
                      id: t.id,
                      title: t.title,
                      role: t.role,
                      status: t.status,
                      output: t.output,
                      attempts: t.attempts,
                      healed: t.healed
                    })),
                    metrics: benchResult.society.metrics
                  },
                  single: benchResult.single,
                  qualityScores: benchResult.qualityScores
                });
              }).catch((err) => {
                send(ws, { type: 'society-error', error: err.message || String(err) });
              });
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
