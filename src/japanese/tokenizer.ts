import kuromoji from 'kuromoji';
import { JapaneseToken } from './types';

export class TokenizerService {
  private tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {}

  /**
   * Initializes the Kuromoji tokenizer if not already initialized.
   */
  public async init(): Promise<void> {
    if (this.tokenizer) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      // In a Chrome extension, public assets are available via chrome.runtime.getURL
      let dicPath = 'dict/';
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        dicPath = chrome.runtime.getURL('dict/');
      }

      console.log('[Japanese Dual Subtitle] Initializing Kuromoji with dict path:', dicPath);

      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) {
          console.error('[Japanese Dual Subtitle] Kuromoji initialization failed:', err);
          reject(err);
          return;
        }
        this.tokenizer = tokenizer;
        console.log('[Japanese Dual Subtitle] Kuromoji initialized successfully.');
        resolve();
      });
    });

    return this.initPromise;
  }

  /**
   * Tokenizes a given Japanese string asynchronously to ensure initialization.
   */
  public async tokenize(text: string): Promise<JapaneseToken[]> {
    if (!text || text.trim() === '') return [];

    if (!this.tokenizer) {
      await this.init();
    }

    if (!this.tokenizer) {
      throw new Error('Tokenizer not initialized');
    }

    const tokens = this.tokenizer.tokenize(text);

    let currentIndex = 0;
    
    return tokens.map((token) => {
      const startIndex = currentIndex;
      const endIndex = currentIndex + token.surface_form.length;
      currentIndex = endIndex;

      return {
        surface: token.surface_form,
        reading: token.reading && token.reading !== '*' ? token.reading : '',
        baseForm: token.basic_form && token.basic_form !== '*' ? token.basic_form : token.surface_form,
        partOfSpeech: token.pos,
        startIndex,
        endIndex,
      };
    });
  }
}
