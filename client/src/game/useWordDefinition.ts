import { useEffect, useState } from 'react';

export type DefinitionStatus = 'idle' | 'loading' | 'success' | 'not-found' | 'error';

export interface DefinitionResult {
  status: DefinitionStatus;
  partOfSpeech?: string;
  definition?: string;
}

const IDLE: DefinitionResult = { status: 'idle' };
const LOADING: DefinitionResult = { status: 'loading' };
const NOT_FOUND: DefinitionResult = { status: 'not-found' };
const ERROR: DefinitionResult = { status: 'error' };

/** Only fetch once a hovered word has held still for a moment, not on every chip a fast mouse sweeps past. */
const DEBOUNCE_MS = 300;

/**
 * Definitions never change, so results are cached across the component's
 * lifetime (and across mounts, since Results remounts each round) rather
 * than refetched every time a word is re-hovered.
 */
const cache = new Map<string, DefinitionResult>();

/**
 * Looks up `word` against the free dictionaryapi.dev API. The API's failure
 * responses are inconsistent in practice (sometimes a documented 404, seen
 * in testing to sometimes be a bare 502 with a plain-text body) - rather than
 * trust any particular error shape, any non-OK response or parse failure is
 * just treated as "no definition available".
 */
export function useWordDefinition(word: string | null): DefinitionResult {
  const [result, setResult] = useState<DefinitionResult>(IDLE);

  useEffect(() => {
    if (!word) {
      setResult(IDLE);
      return;
    }

    const key = word.toLowerCase();
    const cached = cache.get(key);
    if (cached) {
      setResult(cached);
      return;
    }

    setResult(LOADING);
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          cache.set(key, NOT_FOUND);
          setResult(NOT_FOUND);
          return;
        }

        const data = await response.json();
        const meaning = data?.[0]?.meanings?.[0];
        const definition: string | undefined = meaning?.definitions?.[0]?.definition;

        const outcome: DefinitionResult = definition
          ? { status: 'success', partOfSpeech: meaning.partOfSpeech, definition }
          : NOT_FOUND;
        cache.set(key, outcome);
        setResult(outcome);
      } catch {
        // Includes the abort from a newer word superseding this one, which
        // is fine to swallow silently - that request was never going to matter.
        if (!controller.signal.aborted) setResult(ERROR);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [word]);

  return result;
}
