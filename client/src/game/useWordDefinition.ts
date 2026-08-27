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
 * Looks up `word` against our own server's /api/define, which answers
 * entirely from a local WordNet database - no outbound network call, so
 * nothing to rate-limit (this replaced a call to the free dictionaryapi.dev
 * API after its shared Cloudflare tier started throttling us). A "not
 * found" is a real answer from our server (WordNet has no entry - it skips
 * function words like "its") and gets cached; anything else - our server
 * erroring, the request failing - is left uncached so the next hover gets
 * a fresh attempt instead of being stuck on it.
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
        const response = await fetch(`/api/define/${encodeURIComponent(key)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          if (!controller.signal.aborted) setResult(ERROR);
          return;
        }

        const data = await response.json();
        const outcome: DefinitionResult =
          data.status === 'success'
            ? { status: 'success', partOfSpeech: data.partOfSpeech, definition: data.definition }
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
