import {
  COUNTDOWN_MS,
  GAME_DURATION_MS,
  MIN_WORD_LENGTH,
  isValidPath,
  pathToWord,
  scoreWord,
} from '../../shared/src/rules.js';
import type { Path, PlayerResult, ScoredWord, WordRejection } from '../../shared/src/protocol.js';
import { rollBoard } from '../../shared/src/dice.js';
import { isValidWord } from './dictionary.js';
import { solveBoard } from './solver.js';
import type { Room } from './rooms.js';

export function startRound(room: Room): void {
  const board = rollBoard();
  const now = Date.now();

  room.board = board;
  room.phase = 'countdown';
  room.startsAt = now + COUNTDOWN_MS;
  room.endsAt = now + COUNTDOWN_MS + GAME_DURATION_MS;
  // ~2ms for a full 4x4 solve, so the countdown covers it comfortably and the
  // results screen has the answer key ready the moment time runs out.
  room.boardWords = solveBoard(board);
  // A fresh chat for a fresh round - see rooms.ts#addChatMessage for why
  // chat only exists once a round has ended in the first place.
  room.chatMessages = [];
  room.lastActivity = now;

  for (const player of room.players.values()) {
    player.score = 0;
    player.words.clear();
    if (!player.isHost) player.isReady = false;
  }
}

export type SubmitResult =
  | { ok: true; word: string; score: number; path: Path; total: number }
  | { ok: false; word: string; reason: WordRejection };

/**
 * Validate a claimed word against the board, the clock and the dictionary.
 * The client checks all of this too for instant feedback, but the server is
 * the only authority - a client could submit anything.
 */
export function submitWord(room: Room, playerId: string, rawWord: string, path: Path): SubmitResult {
  const player = room.players.get(playerId);
  const word = String(rawWord ?? '').toUpperCase();

  if (!player) return { ok: false, word, reason: 'not-playing' };

  const now = Date.now();
  const live =
    room.phase === 'playing' &&
    room.board !== null &&
    room.startsAt !== null &&
    room.endsAt !== null &&
    now >= room.startsAt &&
    now <= room.endsAt;
  if (!live) return { ok: false, word, reason: 'not-playing' };

  if (word.length < MIN_WORD_LENGTH) return { ok: false, word, reason: 'too-short' };
  if (player.words.has(word)) return { ok: false, word, reason: 'already-found' };

  // The path must be a legal chain of dice that actually spells the word.
  if (!Array.isArray(path) || !isValidPath(path)) {
    return { ok: false, word, reason: 'not-on-board' };
  }
  if (pathToWord(room.board!, path) !== word) {
    return { ok: false, word, reason: 'not-on-board' };
  }

  if (!isValidWord(word)) return { ok: false, word, reason: 'not-a-word' };

  const score = scoreWord(word);
  player.words.set(word, { word, score, path });
  player.score += score;
  room.lastActivity = now;

  return { ok: true, word, score, path, total: player.score };
}

/**
 * Close the round and apply official scoring: any word found by more than one
 * player is struck from every list and scores for nobody.
 */
export function endRound(room: Room): PlayerResult[] {
  room.phase = 'ended';
  room.lastActivity = Date.now();
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }

  const claimCounts = new Map<string, number>();
  for (const player of room.players.values()) {
    for (const word of player.words.keys()) {
      claimCounts.set(word, (claimCounts.get(word) ?? 0) + 1);
    }
  }

  const results: PlayerResult[] = [];
  for (const player of room.players.values()) {
    const words: ScoredWord[] = [];
    let rawScore = 0;
    let totalScore = 0;

    for (const found of player.words.values()) {
      const duplicate = (claimCounts.get(found.word) ?? 1) > 1;
      words.push({ word: found.word, score: found.score, duplicate });
      rawScore += found.score;
      if (!duplicate) totalScore += found.score;
    }

    words.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
    results.push({
      playerId: player.id,
      playerName: player.name,
      words,
      rawScore,
      totalScore,
    });
  }

  results.sort((a, b) => b.totalScore - a.totalScore || b.rawScore - a.rawScore);
  return results;
}
