declare module 'wordpos' {
  export interface WordPosLookupResult {
    pos: string;
    def: string;
    synonyms: string[];
  }

  export default class WordPOS {
    constructor(options?: Record<string, unknown>);
    lookup(word: string): Promise<WordPosLookupResult[]>;
  }
}
