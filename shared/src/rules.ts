/**
 * Pure Boggle rules, shared by client and server.
 *
 * Rules follow the official Boggle rules (officialgamerules.org):
 *  - 4x4 grid of 16 dice, letters must adjoin horizontally, vertically or diagonally.
 *  - No die may be used more than once in a single word.
 *  - Words must be at least 3 letters.
 *  - The "Qu" die counts as two letters.
 *  - Scoring: 3-4 letters = 1, 5 = 2, 6 = 3, 7 = 5, 8+ = 11.
 *  - Any word found by more than one player is struck from every list.
 */

export const BOARD_DIM = 4;
export const BOARD_SIZE = BOARD_DIM * BOARD_DIM; // 16 dice
export const MIN_WORD_LENGTH = 3;

/** Game length. Official Boggle is 3 minutes; this app is spec'd at 90 seconds. */
export const GAME_DURATION_MS = 90 * 1000;

/** Countdown shown to every player before the board is revealed, so nobody gets a head start. */
export const COUNTDOWN_MS = 3000;

/**
 * A board is a flat array of 16 faces, index = row * 4 + col.
 * A face is a single uppercase letter, except the Qu die which is the string "Qu".
 */
export type Board = string[];

/** Cell indices are 0..15; a path is the ordered list of cells spelling a word. */
export type Path = number[];

export const QU = 'Qu';

/**
 * Adjacency, precomputed once. NEIGHBORS[i] lists every cell touching cell i.
 * Used by the solver's inner loop and by the client's drag handler, so it is
 * worth having as a flat lookup rather than recomputing row/col arithmetic.
 */
export const NEIGHBORS: readonly (readonly number[])[] = (() => {
  const table: number[][] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const row = (i / BOARD_DIM) | 0;
    const col = i % BOARD_DIM;
    const neighbors: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= BOARD_DIM || c < 0 || c >= BOARD_DIM) continue;
        neighbors.push(r * BOARD_DIM + c);
      }
    }
    table.push(neighbors);
  }
  return table;
})();

export function areAdjacent(a: number, b: number): boolean {
  return a !== b && NEIGHBORS[a].includes(b);
}

/**
 * Official scoring table. The word is already spelled out in full ("QUIT" is
 * four letters), so plain length is the letter count the rules ask for.
 */
export function scoreWord(word: string): number {
  const length = word.length;
  if (length < MIN_WORD_LENGTH) return 0;
  if (length <= 4) return 1;
  if (length === 5) return 2;
  if (length === 6) return 3;
  if (length === 7) return 5;
  return 11;
}

/** Spell out the word a path traces, expanding the Qu die to two letters. */
export function pathToWord(board: Board, path: Path): string {
  let word = '';
  for (let i = 0; i < path.length; i++) {
    const cell = board[path[i]];
    if (cell === undefined) return '';
    word += cell.toUpperCase();
  }
  return word;
}

/** A path is legal if every cell is in bounds, distinct, and adjacent to the one before it. */
export function isValidPath(path: Path): boolean {
  if (path.length === 0) return false;
  let seen = 0;
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    if (!Number.isInteger(cell) || cell < 0 || cell >= BOARD_SIZE) return false;
    const bit = 1 << cell;
    if (seen & bit) return false; // a die cannot be reused within one word
    seen |= bit;
    if (i > 0 && !areAdjacent(path[i - 1], cell)) return false;
  }
  return true;
}

export function indexToRowCol(index: number): { row: number; col: number } {
  return { row: (index / BOARD_DIM) | 0, col: index % BOARD_DIM };
}
