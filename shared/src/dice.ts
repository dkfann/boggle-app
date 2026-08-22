import { BOARD_SIZE, Board } from './rules.js';

/**
 * The 16 dice of classic Boggle. Each string is one die's six faces.
 * "Qu" is a single face that spells two letters, per the official rules.
 */
export const BOGGLE_DICE: readonly (readonly string[])[] = [
  ['R', 'I', 'F', 'O', 'B', 'X'],
  ['I', 'F', 'E', 'H', 'E', 'Y'],
  ['D', 'E', 'N', 'O', 'W', 'S'],
  ['U', 'T', 'O', 'K', 'N', 'D'],
  ['H', 'M', 'S', 'R', 'A', 'O'],
  ['L', 'U', 'P', 'E', 'T', 'S'],
  ['A', 'C', 'I', 'T', 'O', 'A'],
  ['Y', 'L', 'G', 'K', 'U', 'E'],
  ['Qu', 'B', 'M', 'J', 'O', 'A'],
  ['E', 'H', 'I', 'S', 'P', 'N'],
  ['V', 'E', 'T', 'I', 'G', 'N'],
  ['B', 'A', 'L', 'I', 'Y', 'T'],
  ['E', 'Z', 'A', 'V', 'N', 'D'],
  ['R', 'A', 'L', 'E', 'S', 'C'],
  ['U', 'W', 'I', 'L', 'R', 'G'],
  ['P', 'A', 'C', 'E', 'M', 'D'],
];

/**
 * Shake the tray: shuffle the dice into the 16 slots, then roll each one.
 * Fisher-Yates over an index array so BOGGLE_DICE itself stays immutable.
 */
export function rollBoard(random: () => number = Math.random): Board {
  const order = Array.from({ length: BOARD_SIZE }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const board: Board = new Array(BOARD_SIZE);
  for (let slot = 0; slot < BOARD_SIZE; slot++) {
    const die = BOGGLE_DICE[order[slot]];
    board[slot] = die[Math.floor(random() * die.length)];
  }
  return board;
}
