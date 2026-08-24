import type { WebSocket, WebSocketServer } from 'ws';
import { COUNTDOWN_MS, GAME_DURATION_MS } from '../../shared/src/rules.js';
import type { ClientMessage, Path, ServerMessage } from '../../shared/src/protocol.js';
import {
  MAX_PLAYERS,
  addChatMessage,
  addPlayer,
  canStart,
  createRoom,
  destroyRoom,
  getRoom,
  listPlayers,
  markDisconnected,
  removePlayer,
  serializeRoom,
  sweepRooms,
  type Room,
} from './rooms.js';
import { endRound, startRound, submitWord } from './game.js';

const OPEN = 1; // WebSocket.OPEN, without importing the value at runtime
const HEARTBEAT_MS = 30_000;
const MAX_MESSAGES_PER_SECOND = 40;
const MAX_NAME_LENGTH = 16;
const MAX_CHAT_LENGTH = 300;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

interface Connection {
  ws: WebSocket;
  playerId: string;
  roomId: string | null;
  alive: boolean;
  windowStart: number;
  windowCount: number;
}

/** roomId -> playerId -> connection. One live socket per player per room. */
const byRoom = new Map<string, Map<string, Connection>>();

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === OPEN) ws.send(JSON.stringify(message));
}

function broadcast(roomId: string, message: ServerMessage, exclude?: string): void {
  const peers = byRoom.get(roomId);
  if (!peers) return;
  // Serialize once, not once per recipient.
  const payload = JSON.stringify(message);
  for (const [playerId, peer] of peers) {
    if (playerId === exclude) continue;
    if (peer.ws.readyState === OPEN) peer.ws.send(payload);
  }
}

function attach(connection: Connection, roomId: string): void {
  let peers = byRoom.get(roomId);
  if (!peers) {
    peers = new Map();
    byRoom.set(roomId, peers);
  }
  // A second tab for the same player supersedes the first.
  const previous = peers.get(connection.playerId);
  if (previous && previous !== connection) {
    previous.roomId = null;
    if (previous.ws.readyState === OPEN) previous.ws.close(4000, 'Replaced by a newer session');
  }
  peers.set(connection.playerId, connection);
  connection.roomId = roomId;
}

function detach(connection: Connection): void {
  const roomId = connection.roomId;
  if (!roomId) return;
  const peers = byRoom.get(roomId);
  // Only clear the slot if this socket still owns it - a reconnect may have taken over.
  if (peers?.get(connection.playerId) === connection) {
    peers.delete(connection.playerId);
    if (peers.size === 0) byRoom.delete(roomId);
  }
  connection.roomId = null;
}

function sanitizeName(raw: unknown): string {
  const text = typeof raw === 'string' ? raw : '';
  const cleaned = text.replace(CONTROL_CHARS, '').trim().slice(0, MAX_NAME_LENGTH);
  return cleaned || 'Player';
}

function sanitizeChatText(raw: unknown): string {
  const text = typeof raw === 'string' ? raw : '';
  return text.replace(CONTROL_CHARS, '').trim().slice(0, MAX_CHAT_LENGTH);
}

function sanitizeId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim().slice(0, 64);
  return /^[A-Za-z0-9_-]{4,64}$/.test(id) ? id : null;
}

function sanitizePath(raw: unknown): Path | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 16) return null;
  const path: Path = [];
  for (const value of raw) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 15) return null;
    path.push(value);
  }
  return path;
}

/**
 * Drive the round's clock: reveal the board after the countdown, then close
 * scoring exactly when GAME_DURATION_MS is up. The timestamps in the messages
 * are what the UI counts against; these timers only flip server-side state.
 */
function scheduleRound(room: Room): void {
  if (room.timer) clearTimeout(room.timer);

  room.timer = setTimeout(() => {
    room.phase = 'playing';
    room.timer = setTimeout(() => {
      const results = endRound(room);
      broadcast(room.id, {
        type: 'game_ended',
        results,
        boardWords: room.boardWords ?? [],
        board: room.board ?? [],
      });
    }, GAME_DURATION_MS);
  }, COUNTDOWN_MS);
}

function handleJoin(connection: Connection, roomIdRaw: string | null, name: string): void {
  const room = roomIdRaw ? getRoom(roomIdRaw) : createRoom({ id: connection.playerId, name });

  if (!room) {
    send(connection.ws, { type: 'error', message: 'That room code does not exist.' });
    return;
  }

  const known = room.players.has(connection.playerId);
  if (!known) {
    if (room.players.size >= MAX_PLAYERS) {
      send(connection.ws, { type: 'error', message: 'That room is full.' });
      return;
    }
    // Latecomers wait in the lobby rather than joining a round already in flight.
    if (room.phase === 'countdown' || room.phase === 'playing') {
      send(connection.ws, {
        type: 'error',
        message: 'That round is already under way. Try again when it ends.',
      });
      return;
    }
  }

  addPlayer(room, connection.playerId, name);
  attach(connection, room.id);

  send(connection.ws, {
    type: 'joined',
    room: serializeRoom(room, connection.playerId),
    serverTime: Date.now(),
  });
  broadcast(
    room.id,
    { type: 'room_update', players: listPlayers(room), hostId: room.hostId },
    connection.playerId
  );
}

function handleStart(connection: Connection): void {
  const room = connection.roomId ? getRoom(connection.roomId) : undefined;
  if (!room) return;

  if (room.hostId !== connection.playerId) {
    send(connection.ws, { type: 'error', message: 'Only the host can start the round.' });
    return;
  }
  if (!canStart(room)) {
    send(connection.ws, { type: 'error', message: 'Everyone needs to be ready first.' });
    return;
  }

  startRound(room);
  scheduleRound(room);

  broadcast(room.id, {
    type: 'game_started',
    board: room.board!,
    startsAt: room.startsAt!,
    endsAt: room.endsAt!,
    serverTime: Date.now(),
  });
  broadcast(room.id, { type: 'room_update', players: listPlayers(room), hostId: room.hostId });
}

function handleSubmit(connection: Connection, word: string, path: Path): void {
  const room = connection.roomId ? getRoom(connection.roomId) : undefined;
  if (!room) return;

  const result = submitWord(room, connection.playerId, word, path);

  if (!result.ok) {
    send(connection.ws, { type: 'word_rejected', word: result.word, reason: result.reason });
    return;
  }

  send(connection.ws, {
    type: 'word_accepted',
    word: result.word,
    score: result.score,
    path: result.path,
    total: result.total,
  });
  // Opponents see the score move, never the word itself - that would give it away.
  broadcast(
    room.id,
    {
      type: 'score_update',
      playerId: connection.playerId,
      score: result.total,
      wordCount: room.players.get(connection.playerId)!.words.size,
    },
    connection.playerId
  );
}

function handleChat(connection: Connection, rawText: unknown): void {
  const room = connection.roomId ? getRoom(connection.roomId) : undefined;
  if (!room) return;

  const message = addChatMessage(room, connection.playerId, sanitizeChatText(rawText));
  // Silently dropped: empty after trimming, unknown player, or the round
  // hasn't ended yet - none of these are worth an error round-trip over.
  if (!message) return;

  broadcast(room.id, { type: 'chat_message', message });
}

function handleLeave(connection: Connection): void {
  const room = connection.roomId ? getRoom(connection.roomId) : undefined;
  const roomId = connection.roomId;
  detach(connection);
  if (!room || !roomId) return;

  removePlayer(room, connection.playerId);
  if (room.players.size === 0) {
    destroyRoom(room);
    return;
  }
  broadcast(roomId, { type: 'room_update', players: listPlayers(room), hostId: room.hostId });
}

function handleDisconnect(connection: Connection): void {
  const room = connection.roomId ? getRoom(connection.roomId) : undefined;
  const roomId = connection.roomId;
  detach(connection);
  if (!room || !roomId) return;

  // Keep the seat and any words found: the player may be reloading or on a flaky
  // connection, and ending their round would be worse than showing them offline.
  markDisconnected(room, connection.playerId);
  broadcast(roomId, { type: 'room_update', players: listPlayers(room), hostId: room.hostId });
}

function withinRateLimit(connection: Connection): boolean {
  const now = Date.now();
  if (now - connection.windowStart >= 1000) {
    connection.windowStart = now;
    connection.windowCount = 0;
  }
  return ++connection.windowCount <= MAX_MESSAGES_PER_SECOND;
}

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket) => {
    const connection: Connection = {
      ws,
      playerId: '',
      roomId: null,
      alive: true,
      windowStart: Date.now(),
      windowCount: 0,
    };

    ws.on('pong', () => {
      connection.alive = true;
    });

    ws.on('message', (data: Buffer) => {
      if (!withinRateLimit(connection)) {
        ws.close(4029, 'Too many messages');
        return;
      }

      let message: ClientMessage;
      try {
        message = JSON.parse(data.toString());
      } catch {
        send(ws, { type: 'error', message: 'Malformed message.' });
        return;
      }
      if (!message || typeof message.type !== 'string') return;

      // Every message except the opening join requires an identified player.
      if (message.type === 'join') {
        const playerId = sanitizeId(message.playerId);
        if (!playerId) {
          send(ws, { type: 'error', message: 'Invalid player id.' });
          return;
        }
        connection.playerId = playerId;
        const roomId =
          typeof message.roomId === 'string' ? message.roomId.toUpperCase().slice(0, 8) : null;
        handleJoin(connection, roomId, sanitizeName(message.playerName));
        return;
      }

      if (!connection.playerId || !connection.roomId) return;

      switch (message.type) {
        case 'set_ready': {
          const room = getRoom(connection.roomId);
          const player = room?.players.get(connection.playerId);
          if (!room || !player || player.isHost) return;
          player.isReady = message.ready === true;
          broadcast(room.id, {
            type: 'room_update',
            players: listPlayers(room),
            hostId: room.hostId,
          });
          break;
        }
        case 'start_game':
          handleStart(connection);
          break;
        case 'submit_word': {
          const path = sanitizePath(message.path);
          if (!path || typeof message.word !== 'string' || message.word.length > 32) return;
          handleSubmit(connection, message.word, path);
          break;
        }
        case 'send_chat':
          handleChat(connection, message.text);
          break;
        case 'leave':
          handleLeave(connection);
          break;
      }
    });

    ws.on('close', () => handleDisconnect(connection));
    ws.on('error', () => handleDisconnect(connection));
  });

  // Drop sockets that stopped answering, so rooms don't fill with ghosts.
  const heartbeat = setInterval(() => {
    for (const peers of byRoom.values()) {
      for (const peer of peers.values()) {
        if (!peer.alive) {
          peer.ws.terminate();
          continue;
        }
        peer.alive = false;
        peer.ws.ping();
      }
    }
    sweepRooms();
  }, HEARTBEAT_MS);

  wss.on('close', () => clearInterval(heartbeat));
}
