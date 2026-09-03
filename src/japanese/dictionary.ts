import { DictionaryEntry } from './types';

/**
 * Simple dictionary service for MVP 3.
 * It loads a bundled JMdict JSON file (to be placed under `public/dict/jmdict.json`).
 * The service stores entries in a Map keyed by the expression (Japanese word) and optionally by reading.
 */
export class DictionaryService {
  private dictMap: Map<string, DictionaryEntry> = new Map();
  private loaded = false;

  constructor() {
    // Load dictionary asynchronously; callers can await ensureLoaded() if needed.
    this.loadDictionary();
  }

  private async loadDictionary(): Promise<void> {
    if (this.loaded) return;
    try {
      const url = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL('dict/jmdict.json')
        : 'dict/jmdict.json';
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Dictionary fetch failed: ${resp.status}`);
      const data: DictionaryEntry[] = await resp.json();
      data.forEach(entry => {
        this.dictMap.set(entry.expression, entry);
        if (entry.reading) this.dictMap.set(entry.reading, entry);
      });
      this.loaded = true;
    } catch (e) {
      console.warn('[Japanese Dual Subtitle] Dictionary load error', e);
    }
  }

  /** Ensure the dictionary is loaded before a lookup. */
  public async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.loadDictionary();
  }

  /** Look up a word by its base form (or reading). Returns entry or null. */
  public lookup(baseForm: string): DictionaryEntry | null {
    if (!this.loaded) {
      // fire‑and‑forget load – may be empty now.
      this.loadDictionary();
    }
    return this.dictMap.get(baseForm) ?? null;
  }
}

export type { DictionaryEntry } from './types';
