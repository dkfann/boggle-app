import { Board, BOARD_SIZE, MIN_WORD_LENGTH, NEIGHBORS, scoreWord } from '../../shared/src/rules.js';
import type { BoardWord } from '../../shared/src/protocol.js';
import { WordTrie, letterIndex } from './wordTrie.js';
import { getDictionary } from './dictionary.js';

/**
 * Exhaustively find every word the board contains.
 *
 * Depth-first from all 16 cells, walking the dictionary trie in lockstep with
 * the path so a dead prefix prunes the whole subtree. Visited cells live in a
 * 16-bit mask rather than a Set, and the path/letter stacks are reused across
 * the entire solve, so the hot loop allocates nothing per step.
 *
 * Results are deduplicated by trie node: the same word reachable by several
 * paths is reported once, keeping the first path found.
 */
export function solveBoard(board: Board, trie: WordTrie = getDictionary()): BoardWord[] {
  const results: BoardWord[] = [];
  trie.nextGeneration();

  // Precompute each cell's trie edges once: the Qu die walks two levels.
  const faces: { letters: number[]; text: string }[] = new Array(BOARD_SIZE);
  for (let cell = 0; cell < BOARD_SIZE; cell++) {
    const face = (board[cell] ?? '').toUpperCase();
    const letters: number[] = [];
    for (let i = 0; i < face.length; i++) letters.push(letterIndex(face.charCodeAt(i)));
    faces[cell] = { letters, text: face };
  }

  const path = new Int32Array(BOARD_SIZE);
  const letterStack: string[] = [];

  const visit = (cell: number, node: number, visited: number, depth: number): void => {
    const face = faces[cell];

    // Descend one trie level per letter on the face (two for "Qu").
    let next = node;
    for (let i = 0; i < face.letters.length; i++) {
      const letter = face.letters[i];
      if (letter < 0 || letter > 25) return;
      next = trie.child(next, letter);
      if (next === 0) return; // no word continues with this prefix
    }

    path[depth] = cell;
    letterStack.push(face.text);
    const nextVisited = visited | (1 << cell);

    if (trie.isTerminal(next) && trie.claim(next)) {
      const word = letterStack.join('').toUpperCase();
      if (word.length >= MIN_WORD_LENGTH) {
        results.push({
          word,
          score: scoreWord(word),
          path: Array.prototype.slice.call(path, 0, depth + 1),
        });
      }
    }

    const neighbors = NEIGHBORS[cell];
    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      if (nextVisited & (1 << neighbor)) continue; // a die may not repeat in one word
      visit(neighbor, next, nextVisited, depth + 1);
    }

    letterStack.pop();
  };

  for (let cell = 0; cell < BOARD_SIZE; cell++) {
    visit(cell, 0, 0, 0);
  }

  // Highest scoring first, then alphabetical - the order the results panel wants.
  results.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  return results;
}

/** Total points available on a board, useful for showing how much was left behind. */
export function totalBoardScore(words: BoardWord[]): number {
  let total = 0;
  for (const word of words) total += word.score;
  return total;
}
