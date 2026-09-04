import { DictionaryEntry } from './types';

/**
 * Dictionary service for MVP 4.
 * Loads the JMdict-simplified common-only JSON dataset.
 */
export class DictionaryService {
  private dictMap: Map<string, DictionaryEntry> = new Map();
  private loaded = false;
  private loading = false;
  private loadPromise: Promise<void> | null = null;

  constructor() {
    this.ensureLoaded().catch(e => console.warn('[Japanese Dual Subtitle] Dictionary load error', e));
  }

  private async loadDictionary(): Promise<void> {
    if (this.loaded) return;
    this.loading = true;
    try {
      const url = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL('dict/jmdict-eng-common.json')
        : 'dict/jmdict-eng-common.json';
        
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Dictionary fetch failed: ${resp.status}`);
      
      const data = await resp.json();
      const words: any[] = data.words;

      for (const word of words) {
        const expression = word.kanji && word.kanji.length > 0 ? word.kanji[0].text : word.kana[0].text;
        const reading = word.kana && word.kana.length > 0 ? word.kana[0].text : '';
        const meanings = word.sense.flatMap((s: any) => s.gloss.map((g: any) => g.text));
        const partOfSpeech = word.sense && word.sense.length > 0 ? word.sense[0].partOfSpeech || [] : [];

        const entry: DictionaryEntry = {
          expression,
          reading,
          meanings,
          partOfSpeech
        };

        // Index by all kanji forms
        if (word.kanji) {
          for (const k of word.kanji) {
            if (!this.dictMap.has(k.text)) {
              this.dictMap.set(k.text, entry);
            }
          }
        }
        // Index by all kana readings
        if (word.kana) {
          for (const k of word.kana) {
            if (!this.dictMap.has(k.text)) {
              this.dictMap.set(k.text, entry);
            }
          }
        }
      }
      this.loaded = true;
    } catch (e) {
      console.warn('[Japanese Dual Subtitle] Dictionary load error', e);
    } finally {
      this.loading = false;
    }
  }

  /** Ensure the dictionary is loaded before a lookup. */
  public ensureLoaded(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (!this.loadPromise) {
      this.loadPromise = this.loadDictionary();
    }
    return this.loadPromise;
  }

  public isLoaded(): boolean {
    return this.loaded;
  }

  public isLoading(): boolean {
    return this.loading;
  }

  /** Look up a word by its base form (or reading). Returns entry or null. */
  public lookup(baseForm: string): DictionaryEntry | null {
    if (!this.loaded && !this.loading) {
      this.ensureLoaded();
    }
    return this.dictMap.get(baseForm) ?? null;
  }
}

export type { DictionaryEntry } from './types';
