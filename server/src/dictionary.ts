import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIN_WORD_LENGTH } from '../../shared/src/rules.js';
import { WordTrie } from './wordTrie.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * ENABLE1 (Enhanced North American Benchmark Lexicon), the public-domain word
 * list behind most word-game judges. It is the right fit for the official
 * Boggle rules because it already excludes exactly what the rules exclude:
 * proper nouns, abbreviations, contractions and hyphenated forms, while
 * including the plurals and verb forms the rules explicitly allow.
 */
/**
 * Walk up from this module until `data/enable1.txt` turns up, so the same code
 * works from `src/` under tsx and from the deeper `dist/server/src/` layout
 * after a build. `BOGGLE_DICTIONARY` overrides it outright.
 */
function findDictionary(): string {
  const override = process.env.BOGGLE_DICTIONARY;
  if (override) return override;

  let dir = here;
  for (let depth = 0; depth < 6; depth++) {
    const candidate = join(dir, 'data', 'enable1.txt');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    'Could not find data/enable1.txt. Set BOGGLE_DICTIONARY to its path.'
  );
}

let trie: WordTrie | null = null;

export function loadDictionary(): WordTrie {
  if (trie) return trie;

  const started = Date.now();
  const contents = readFileSync(findDictionary(), 'utf8');
  const built = new WordTrie();

  let start = 0;
  let skipped = 0;
  while (start < contents.length) {
    let end = contents.indexOf('\n', start);
    if (end === -1) end = contents.length;
    // Trim the trailing \r of CRLF files without allocating a substring first.
    let stop = end;
    if (stop > start && contents.charCodeAt(stop - 1) === 13) stop--;

    if (stop - start >= MIN_WORD_LENGTH) {
      const word = contents.slice(start, stop).toUpperCase();
      if (!built.insert(word)) skipped++;
    }
    start = end + 1;
  }

  trie = built;
  console.log(
    `Dictionary: ${built.size.toLocaleString()} words (${built.nodes.toLocaleString()} trie nodes) ` +
      `in ${Date.now() - started}ms${skipped ? `, ${skipped} non-alphabetic entries skipped` : ''}`
  );
  return trie;
}

export function getDictionary(): WordTrie {
  if (!trie) throw new Error('Dictionary not loaded');
  return trie;
}

/** Words shorter than the minimum are never in the trie, so this also enforces length. */
export function isValidWord(word: string): boolean {
  return getDictionary().has(word);
}
