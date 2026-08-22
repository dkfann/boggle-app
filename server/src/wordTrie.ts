const ALPHABET = 26;
const A_CODE = 65; // 'A'

/**
 * A prefix trie stored in flat typed arrays.
 *
 * The dictionary is used two ways every round: O(len) membership checks on each
 * submitted word, and an exhaustive board solve that walks prefixes millions of
 * times. Object/Map-per-node tries make that walk pointer-chase across the heap;
 * a flat Int32Array keeps children contiguous and the whole solve cache-friendly.
 *
 * Node 0 is the root, so a child value of 0 means "no such edge".
 */
export class WordTrie {
  private children: Int32Array;
  private terminal: Uint8Array;
  private capacity: number;
  private nodeCount = 1;
  private wordCount = 0;

  /**
   * Per-node marker used by the solver to collect each word once per board
   * without allocating a Set. Stamped with a generation counter so a new solve
   * invalidates the previous marks without clearing the array.
   */
  private stamps: Int32Array;
  private generation = 0;

  constructor(initialCapacity = 1 << 19) {
    this.capacity = initialCapacity;
    this.children = new Int32Array(this.capacity * ALPHABET);
    this.terminal = new Uint8Array(this.capacity);
    this.stamps = new Int32Array(this.capacity);
  }

  private grow(): void {
    const capacity = this.capacity * 2;
    const children = new Int32Array(capacity * ALPHABET);
    children.set(this.children);
    const terminal = new Uint8Array(capacity);
    terminal.set(this.terminal);
    const stamps = new Int32Array(capacity);
    stamps.set(this.stamps);
    this.children = children;
    this.terminal = terminal;
    this.stamps = stamps;
    this.capacity = capacity;
  }

  /** Insert an uppercase A-Z word. Returns false if the word has other characters. */
  insert(word: string): boolean {
    let node = 0;
    for (let i = 0; i < word.length; i++) {
      const letter = word.charCodeAt(i) - A_CODE;
      if (letter < 0 || letter >= ALPHABET) return false;
      const slot = node * ALPHABET + letter;
      let next = this.children[slot];
      if (next === 0) {
        if (this.nodeCount >= this.capacity) this.grow();
        next = this.nodeCount++;
        this.children[node * ALPHABET + letter] = next;
      }
      node = next;
    }
    if (!this.terminal[node]) {
      this.terminal[node] = 1;
      this.wordCount++;
    }
    return true;
  }

  /** Follow one edge. Returns 0 when the prefix does not continue. */
  child(node: number, letter: number): number {
    return this.children[node * ALPHABET + letter];
  }

  isTerminal(node: number): boolean {
    return this.terminal[node] === 1;
  }

  has(word: string): boolean {
    let node = 0;
    for (let i = 0; i < word.length; i++) {
      const letter = word.charCodeAt(i) - A_CODE;
      if (letter < 0 || letter >= ALPHABET) return false;
      node = this.children[node * ALPHABET + letter];
      if (node === 0) return false;
    }
    return this.terminal[node] === 1;
  }

  /** Begin a fresh collection pass; previously stamped nodes become unmarked. */
  nextGeneration(): void {
    this.generation++;
  }

  /** Mark a terminal node as collected. Returns false if it was already taken this pass. */
  claim(node: number): boolean {
    if (this.stamps[node] === this.generation) return false;
    this.stamps[node] = this.generation;
    return true;
  }

  get size(): number {
    return this.wordCount;
  }

  get nodes(): number {
    return this.nodeCount;
  }
}

export const letterIndex = (charCode: number): number => charCode - A_CODE;
