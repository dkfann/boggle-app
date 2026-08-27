import WordPOS from 'wordpos';

const wordpos = new WordPOS();

const POS_LABELS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  a: 'adjective',
  s: 'adjective',
  r: 'adverb',
};

export interface WordDefinition {
  partOfSpeech: string;
  definition: string;
}

/**
 * Looks up `word` in the local WordNet database (via wordpos) - entirely
 * offline, so it can't be rate limited or knocked over the way the old
 * dictionaryapi.dev call was. WordNet skips function words (pronouns,
 * articles, etc.), so a handful of valid Boggle words like "ITS" have no
 * entry; that is a real coverage gap, not a bug. When a word has several
 * senses, WordNet's own ordering puts the most common one first.
 */
export async function lookupDefinition(word: string): Promise<WordDefinition | null> {
  const results = await wordpos.lookup(word.toLowerCase());
  const first = results[0];
  if (!first) return null;

  return {
    partOfSpeech: POS_LABELS[first.pos] ?? first.pos,
    definition: first.def.trim(),
  };
}
