import type { Board, BoardWord, PlayerResult } from '../../../shared/src/protocol';
import { DEFAULT_GAME_DURATION_MS } from '../../../shared/src/rules';

export const DEBUG_DURATION_MS = DEFAULT_GAME_DURATION_MS;

/**
 * Fixture data for `?debugResults=1` - see App.tsx. Every path below is a real,
 * hand-verified chain of adjacent cells on `DEBUG_BOARD`, so the trace overlay
 * renders exactly as it would for a genuine round.
 *
 *    Qu  I  T  S
 *     A  E  R  N
 *     D  L  O  P
 *     C  H  M  B
 */
export const DEBUG_BOARD: Board = [
  'Qu', 'I', 'T', 'S',
  'A', 'E', 'R', 'N',
  'D', 'L', 'O', 'P',
  'C', 'H', 'M', 'B',
];

export const DEBUG_BOARD_WORDS: BoardWord[] = [
  { word: 'ITS', score: 1, path: [1, 2, 3] },
  { word: 'TIE', score: 1, path: [2, 1, 5] },
  { word: 'ERN', score: 1, path: [5, 6, 7] },
  { word: 'HOLD', score: 1, path: [13, 10, 9, 8] },
  { word: 'MOLD', score: 1, path: [14, 10, 9, 8] },
  { word: 'LOP', score: 1, path: [9, 10, 11] },
  { word: 'OLD', score: 1, path: [10, 9, 8] },
];

export const DEBUG_PLAYER_ID = 'debug-you';

export const DEBUG_RESULTS: PlayerResult[] = [
  {
    playerId: DEBUG_PLAYER_ID,
    playerName: 'You',
    words: [
      { word: 'ITS', score: 1, duplicate: false },
      { word: 'TIE', score: 1, duplicate: true },
      { word: 'HOLD', score: 1, duplicate: false },
    ],
    rawScore: 3,
    totalScore: 2,
  },
  {
    playerId: 'debug-rival',
    playerName: 'Rival',
    words: [
      { word: 'TIE', score: 1, duplicate: true },
      { word: 'ERN', score: 1, duplicate: false },
      { word: 'MOLD', score: 1, duplicate: false },
    ],
    rawScore: 3,
    totalScore: 2,
  },
];
