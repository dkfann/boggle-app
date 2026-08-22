import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  MIN_WORD_LENGTH,
  NEIGHBORS,
  areAdjacent,
  isValidPath,
  pathToWord,
  scoreWord,
} from '../../shared/src/rules.js';
import { BOGGLE_DICE, rollBoard } from '../../shared/src/dice.js';

// Board used across tests:
//   Qu I  T  S
//   A  E  R  N
//   D  L  O  P
//   C  H  M  B
const BOARD = ['Qu', 'I', 'T', 'S', 'A', 'E', 'R', 'N', 'D', 'L', 'O', 'P', 'C', 'H', 'M', 'B'];

test('official scoring table', () => {
  assert.equal(scoreWord('CAT'), 1, '3 letters');
  assert.equal(scoreWord('CATS'), 1, '4 letters');
  assert.equal(scoreWord('CATER'), 2, '5 letters');
  assert.equal(scoreWord('CATERS'), 3, '6 letters');
  assert.equal(scoreWord('CATERER'), 5, '7 letters');
  assert.equal(scoreWord('CATERERS'), 11, '8 letters');
  assert.equal(scoreWord('CATERWAULS'), 11, '10 letters scores the same as 8');
  assert.equal(scoreWord('AT'), 0, 'below the minimum length scores nothing');
});

test('Qu counts as two letters for scoring', () => {
  // The Qu die contributes both letters, so QUIT is a 4-letter word worth 1
  // and QUOTED is a 6-letter word worth 3.
  assert.equal(scoreWord('QUIT'), 1);
  assert.equal(scoreWord('QUOTED'), 3);
});

test('adjacency covers all eight directions and excludes self', () => {
  assert.equal(NEIGHBORS.length, BOARD_SIZE);
  assert.deepEqual([...NEIGHBORS[0]].sort((a, b) => a - b), [1, 4, 5], 'corner has 3 neighbours');
  assert.equal(NEIGHBORS[5].length, 8, 'interior cell has 8 neighbours');
  assert.equal(NEIGHBORS[3].length, 3, 'other corner has 3 neighbours');
  assert.ok(areAdjacent(5, 0), 'diagonals count');
  assert.ok(!areAdjacent(0, 0), 'a cell is not adjacent to itself');
  assert.ok(!areAdjacent(3, 4), 'wrapping across a row edge is not adjacency');
});

test('paths must be contiguous, in bounds, and may not reuse a die', () => {
  assert.ok(isValidPath([0, 1, 2, 3]), 'straight line along a row');
  assert.ok(isValidPath([0, 5, 10, 15]), 'diagonal');
  assert.ok(!isValidPath([0, 2]), 'gap between cells');
  assert.ok(!isValidPath([0, 1, 0]), 'a die may not be used twice');
  assert.ok(!isValidPath([3, 4]), 'no wrapping from end of a row to the start of the next');
  assert.ok(!isValidPath([]), 'empty path');
  assert.ok(!isValidPath([16]), 'out of bounds');
  assert.ok(!isValidPath([-1]), 'negative index');
});

test('a path spells its word, expanding the Qu die', () => {
  assert.equal(pathToWord(BOARD, [0, 1, 2]), 'QUIT');
  assert.equal(pathToWord(BOARD, [8, 9, 5]), 'DLE');
  assert.equal(pathToWord(BOARD, []), '');
});

test('minimum word length is three letters', () => {
  assert.equal(MIN_WORD_LENGTH, 3);
});

/**
 * Each rolled face must be attributable to a *distinct* die. Greedy matching is
 * not enough (an early face can claim a die a later face needs), so this runs a
 * proper bipartite matching over the 16 slots.
 */
function everyFaceHasItsOwnDie(board: string[]): boolean {
  const dieForSlot = new Array<number>(BOGGLE_DICE.length).fill(-1);

  const assign = (slot: number, seen: boolean[]): boolean => {
    for (let die = 0; die < BOGGLE_DICE.length; die++) {
      if (seen[die] || !BOGGLE_DICE[die].includes(board[slot])) continue;
      seen[die] = true;
      if (dieForSlot[die] === -1 || assign(dieForSlot[die], seen)) {
        dieForSlot[die] = slot;
        return true;
      }
    }
    return false;
  };

  for (let slot = 0; slot < board.length; slot++) {
    if (!assign(slot, new Array<boolean>(BOGGLE_DICE.length).fill(false))) return false;
  }
  return true;
}

test('rollBoard shakes 16 dice, each used exactly once', () => {
  for (let trial = 0; trial < 200; trial++) {
    const board = rollBoard();
    assert.equal(board.length, BOARD_SIZE);
    assert.ok(everyFaceHasItsOwnDie(board), `no distinct-die assignment for ${board.join(' ')}`);
  }
});

test('rollBoard uses the supplied random source deterministically', () => {
  const sequence = () => {
    let i = 0;
    const values = Array.from({ length: 64 }, (_, k) => ((k * 37) % 101) / 101);
    return () => values[i++ % values.length];
  };
  assert.deepEqual(rollBoard(sequence()), rollBoard(sequence()), 'same source, same board');
});

test('the dice set is the classic 16-die Boggle distribution', () => {
  assert.equal(BOGGLE_DICE.length, BOARD_SIZE);
  for (const die of BOGGLE_DICE) assert.equal(die.length, 6, 'six faces per die');

  const signature = BOGGLE_DICE.map((die) => [...die].sort().join('')).sort();
  assert.deepEqual(signature, [
    'AACIOT', 'ABILTY', 'ABJMOQu', 'ACDEMP', 'ACELRS', 'ADENVZ', 'AHMORS', 'BFIORX',
    'DENOSW', 'DKNOTU', 'EEFHIY', 'EGINTV', 'EGKLUY', 'EHINPS', 'ELPSTU', 'GILRUW',
  ]);

  const quDice = BOGGLE_DICE.filter((die) => die.includes('Qu'));
  assert.equal(quDice.length, 1, 'exactly one Qu die');
});
