import { customAlphabet } from 'nanoid';
import type { Board, FoundWord, PlayerInfo, RoomState, BoardWord, GamePhase } from '../../shared/src/protocol.js';

/** Room codes people read aloud: no 0/O/1/I to confuse. */
const roomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

export const MAX_PLAYERS = 8;
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000;
const IDLE_ROOM_TTL_MS = 2 * 60 * 60 * 1000;

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
  score: number;
  /** Insertion-ordered, and gives O(1) "already found" checks during play. */
  words: Map<string, FoundWord>;
}

export interface Room {
  id: string;
  hostId: string;
  players: Map<string, Player>;
  phase: GamePhase;
  board: Board | null;
  startsAt: number | null;
  endsAt: number | null;
  /** Full solution, computed once when the round starts so results are instant. */
  boardWords: BoardWord[] | null;
  timer: NodeJS.Timeout | null;
  lastActivity: number;
}

const rooms = new Map<string, Room>();

export function createRoom(host: { id: string; name: string }): Room {
  let id = roomCode();
  while (rooms.has(id)) id = roomCode();

  const room: Room = {
    id,
    hostId: host.id,
    players: new Map(),
    phase: 'lobby',
    board: null,
    startsAt: null,
    endsAt: null,
    boardWords: null,
    timer: null,
    lastActivity: Date.now(),
  };
  addPlayer(room, host.id, host.name);
  rooms.set(id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id.toUpperCase());
}

export function addPlayer(room: Room, id: string, name: string): Player {
  const existing = room.players.get(id);
  if (existing) {
    existing.connected = true;
    existing.name = name;
    room.lastActivity = Date.now();
    return existing;
  }

  const player: Player = {
    id,
    name,
    isHost: room.players.size === 0,
    // The host does not need to ready up; they hold the start button.
    isReady: room.players.size === 0,
    connected: true,
    score: 0,
    words: new Map(),
  };
  if (player.isHost) room.hostId = id;
  room.players.set(id, player);
  room.lastActivity = Date.now();
  return player;
}

export function removePlayer(room: Room, playerId: string): void {
  room.players.delete(playerId);
  room.lastActivity = Date.now();

  if (room.players.size === 0) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    return;
  }

  if (playerId === room.hostId) {
    const next = room.players.values().next().value as Player | undefined;
    if (next) {
      next.isHost = true;
      next.isReady = true;
      room.hostId = next.id;
    }
  }
}

export function markDisconnected(room: Room, playerId: string): void {
  const player = room.players.get(playerId);
  if (player) player.connected = false;
  room.lastActivity = Date.now();
}

/** Everyone connected other than the host must be ready, and a round can't already be live. */
export function canStart(room: Room): boolean {
  if (room.phase === 'countdown' || room.phase === 'playing') return false;
  const active = [...room.players.values()].filter((p) => p.connected);
  return active.length >= 1 && active.every((p) => p.isReady || p.isHost);
}

export function toPlayerInfo(player: Player): PlayerInfo {
  return {
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    isReady: player.isReady,
    connected: player.connected,
    score: player.score,
    wordCount: player.words.size,
  };
}

export function listPlayers(room: Room): PlayerInfo[] {
  return [...room.players.values()].map(toPlayerInfo);
}

export function serializeRoom(room: Room, playerId: string): RoomState {
  const player = room.players.get(playerId);
  return {
    id: room.id,
    hostId: room.hostId,
    players: listPlayers(room),
    phase: room.phase,
    // Never leak the board before the countdown finishes.
    board: room.phase === 'lobby' ? null : room.board,
    startsAt: room.startsAt,
    endsAt: room.endsAt,
    yourPlayerId: playerId,
    yourWords: player ? [...player.words.values()] : [],
    yourScore: player?.score ?? 0,
  };
}

export function destroyRoom(room: Room): void {
  if (room.timer) clearTimeout(room.timer);
  rooms.delete(room.id);
}

/** Drop rooms nobody is connected to, and long-idle ones, so memory stays flat. */
export function sweepRooms(now = Date.now()): number {
  let removed = 0;
  for (const room of rooms.values()) {
    const anyoneHere = [...room.players.values()].some((p) => p.connected);
    const idleFor = now - room.lastActivity;
    if ((!anyoneHere && idleFor > EMPTY_ROOM_TTL_MS) || idleFor > IDLE_ROOM_TTL_MS) {
      destroyRoom(room);
      removed++;
    }
  }
  return removed;
}

export function roomCount(): number {
  return rooms.size;
}
