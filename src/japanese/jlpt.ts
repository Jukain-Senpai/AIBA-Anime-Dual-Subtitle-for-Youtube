export type JLPTKnownLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type JLPTLevel = JLPTKnownLevel | null;

export interface JLPTVocabularyEntry {
  id: string;
  expression: string;
  reading: string;
  level: JLPTKnownLevel;
  other_forms?: string[];
  other_readings?: string[];
}

interface JLPTDataset {
  metadata: {
    counts: Record<JLPTKnownLevel, number> & { total: number };
  };
  entries: JLPTVocabularyEntry[];
}

interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface JLPTServiceOptions {
  assetUrl?: string;
  fetcher?: (url: string) => Promise<FetchResponse>;
}

interface IndexedMatch {
  id: string;
  level: JLPTKnownLevel;
}

const LEVELS = new Set<JLPTKnownLevel>(['N5', 'N4', 'N3', 'N2', 'N1']);

function normalizeExpression(value: string): string {
  return value.normalize('NFKC').trim();
}

function normalizeReading(value: string): string {
  return normalizeExpression(value).replace(/[\u30a1-\u30f6]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0x60),
  );
}

function pairKey(expression: string, reading: string): string {
  return `${expression}\u0000${reading}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isVocabularyEntry(value: unknown): value is JLPTVocabularyEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<JLPTVocabularyEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.expression === 'string' &&
    typeof entry.reading === 'string' &&
    typeof entry.level === 'string' &&
    LEVELS.has(entry.level as JLPTKnownLevel) &&
    (entry.other_forms === undefined || isStringArray(entry.other_forms)) &&
    (entry.other_readings === undefined || isStringArray(entry.other_readings))
  );
}

function isDataset(value: unknown): value is JLPTDataset {
  if (!value || typeof value !== 'object') return false;
  const dataset = value as Partial<JLPTDataset>;
  return Array.isArray(dataset.entries) && dataset.entries.every(isVocabularyEntry);
}

/**
 * Loads and indexes the packaged OpenJLPT vocabulary subset.
 *
 * Exact matching uses the primary expression/reading pair plus alternates paired
 * with the primary value on the other axis. Alternate forms and alternate readings
 * are never cross-multiplied because the source does not encode those associations.
 */
export class JLPTService {
  private readonly assetUrl?: string;
  private readonly fetcher: (url: string) => Promise<FetchResponse>;
  private exactPairIndex = new Map<string, IndexedMatch | null>();
  private expressionIndex = new Map<string, IndexedMatch | null>();
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private loadError: Error | null = null;

  constructor(options: JLPTServiceOptions = {}) {
    this.assetUrl = options.assetUrl;
    this.fetcher = options.fetcher ?? ((url) => fetch(url));
  }

  public ensureLoaded(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.load().catch((error: unknown) => {
      this.loadError = error instanceof Error ? error : new Error(String(error));
      console.warn('[Japanese Dual Subtitle] JLPT vocabulary load error', this.loadError);
    });
    return this.loadPromise;
  }

  public isLoaded(): boolean {
    return this.loaded;
  }

  public getLoadError(): Error | null {
    return this.loadError;
  }

  public lookup(baseForm: string, reading = '', surface = ''): JLPTLevel {
    if (!this.loaded) {
      if (!this.loadPromise) void this.ensureLoaded();
      return null;
    }

    const normalizedBase = normalizeExpression(baseForm);
    const normalizedReading = normalizeReading(reading);

    if (normalizedBase && normalizedReading) {
      const exact = this.exactPairIndex.get(pairKey(normalizedBase, normalizedReading));
      if (exact) return exact.level;
      if (exact === null) return null;
    }

    const baseMatch = normalizedBase ? this.expressionIndex.get(normalizedBase) : undefined;
    if (baseMatch) return baseMatch.level;
    if (baseMatch === null) return null;

    const normalizedSurface = normalizeExpression(surface);
    if (normalizedSurface && normalizedSurface !== normalizedBase) {
      return this.expressionIndex.get(normalizedSurface)?.level ?? null;
    }

    return null;
  }

  private resolveAssetUrl(): string {
    if (this.assetUrl) return this.assetUrl;
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL('jlpt/jlpt-vocab.json');
    }
    return 'jlpt/jlpt-vocab.json';
  }

  private addIndexMatch(
    index: Map<string, IndexedMatch | null>,
    key: string,
    match: IndexedMatch,
  ): void {
    if (!key) return;
    const existing = index.get(key);
    if (existing === undefined) {
      index.set(key, match);
    } else if (existing === null || existing.id !== match.id) {
      index.set(key, null);
    }
  }

  private async load(): Promise<void> {
    const response = await this.fetcher(this.resolveAssetUrl());
    if (!response.ok) throw new Error(`JLPT vocabulary fetch failed: ${response.status}`);

    const data: unknown = await response.json();
    if (!isDataset(data)) throw new Error('JLPT vocabulary asset has an invalid structure.');

    const exactPairIndex = new Map<string, IndexedMatch | null>();
    const expressionIndex = new Map<string, IndexedMatch | null>();

    for (const entry of data.entries) {
      const match = { id: entry.id, level: entry.level };
      const expression = normalizeExpression(entry.expression);
      const reading = normalizeReading(entry.reading);
      this.addIndexMatch(exactPairIndex, pairKey(expression, reading), match);
      this.addIndexMatch(expressionIndex, expression, match);

      for (const alternate of entry.other_forms ?? []) {
        const alternateExpression = normalizeExpression(alternate);
        this.addIndexMatch(exactPairIndex, pairKey(alternateExpression, reading), match);
        this.addIndexMatch(expressionIndex, alternateExpression, match);
      }

      for (const alternate of entry.other_readings ?? []) {
        this.addIndexMatch(
          exactPairIndex,
          pairKey(expression, normalizeReading(alternate)),
          match,
        );
      }
    }

    this.exactPairIndex = exactPairIndex;
    this.expressionIndex = expressionIndex;
    this.loaded = true;
    this.loadError = null;
  }
}
