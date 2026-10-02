import {
  VOCABULARY_SCHEMA_VERSION,
  type SavedVocabulary,
  type SavedVocabularyStore,
  type VocabularyDraft,
} from '../types/vocabulary.ts';
import { createVocabularyIdentity, type VocabularyIdentityInput } from './vocabularyIdentity.ts';
import { isValidYouTubeVideoId, normalizeVocabularySource } from '../vocabulary/youtubeSource.ts';

export const VOCABULARY_STORAGE_KEY = 'aiba_saved_vocabulary_v1';

export interface VocabularyStorageArea {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export class VocabularyStorageError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'VocabularyStorageError';
    this.cause = cause;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSavedVocabulary(value: unknown): value is SavedVocabulary {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<SavedVocabulary>;
  const validSource = entry.source === undefined || (
    !!entry.source &&
    typeof entry.source === 'object' &&
    typeof entry.source.videoId === 'string' &&
    isValidYouTubeVideoId(entry.source.videoId) &&
    typeof entry.source.timestamp === 'number' &&
    Number.isFinite(entry.source.timestamp) &&
    (entry.source.videoTitle === undefined || typeof entry.source.videoTitle === 'string') &&
    (entry.source.subtitleText === undefined || typeof entry.source.subtitleText === 'string')
  );
  return typeof entry.id === 'string' &&
    typeof entry.expression === 'string' &&
    typeof entry.reading === 'string' &&
    typeof entry.baseForm === 'string' &&
    typeof entry.surface === 'string' &&
    isStringArray(entry.meanings) &&
    isStringArray(entry.partOfSpeech) &&
    (entry.jlptLevel === null || ['N5', 'N4', 'N3', 'N2', 'N1'].includes(entry.jlptLevel ?? '')) &&
    typeof entry.createdAt === 'string' &&
    typeof entry.updatedAt === 'string' &&
    validSource;
}

export function createEmptyVocabularyStore(): SavedVocabularyStore {
  return { schemaVersion: VOCABULARY_SCHEMA_VERSION, entries: {} };
}

export function decodeVocabularyStore(value: unknown): SavedVocabularyStore {
  if (value === undefined || value === null) return createEmptyVocabularyStore();
  if (!value || typeof value !== 'object') {
    throw new VocabularyStorageError('Saved vocabulary data is invalid.');
  }

  const store = value as Partial<SavedVocabularyStore>;
  if (store.schemaVersion !== VOCABULARY_SCHEMA_VERSION) {
    throw new VocabularyStorageError(`Unsupported saved vocabulary schema: ${String(store.schemaVersion)}.`);
  }
  if (!store.entries || typeof store.entries !== 'object' || Array.isArray(store.entries)) {
    throw new VocabularyStorageError('Saved vocabulary entries are invalid.');
  }

  for (const [id, entry] of Object.entries(store.entries)) {
    if (!isSavedVocabulary(entry) || entry.id !== id) {
      throw new VocabularyStorageError(`Saved vocabulary entry "${id}" is invalid.`);
    }
  }
  return { schemaVersion: VOCABULARY_SCHEMA_VERSION, entries: { ...store.entries } };
}

function byMostRecentlySaved(a: SavedVocabulary, b: SavedVocabulary): number {
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

/** Runs only in the background worker, making its queue cross-context authoritative. */
export class VocabularyRepository {
  private queue: Promise<void> = Promise.resolve();
  private readonly storage: VocabularyStorageArea;
  private readonly now: () => string;

  constructor(
    storage: VocabularyStorageArea,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.storage = storage;
    this.now = now;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async readStore(): Promise<SavedVocabularyStore> {
    try {
      return decodeVocabularyStore(await this.storage.get(VOCABULARY_STORAGE_KEY));
    } catch (error) {
      if (error instanceof VocabularyStorageError) throw error;
      throw new VocabularyStorageError('Unable to read saved vocabulary.', error);
    }
  }

  public getAll(): Promise<SavedVocabulary[]> {
    return this.enqueue(async () => Object.values((await this.readStore()).entries).sort(byMostRecentlySaved));
  }

  public save(draft: VocabularyDraft): Promise<SavedVocabulary> {
    const snapshot: VocabularyDraft = {
      ...draft,
      meanings: [...draft.meanings],
      partOfSpeech: [...draft.partOfSpeech],
        source: normalizeVocabularySource(draft.source),
    };

    return this.enqueue(async () => {
      const store = await this.readStore();
      const identity = createVocabularyIdentity(snapshot);
      const existing = store.entries[identity.id];
      if (existing) return existing;

      const timestamp = this.now();
      const entry: SavedVocabulary = {
        ...snapshot,
        expression: identity.expression,
        reading: identity.reading,
        baseForm: snapshot.baseForm.normalize('NFKC').trim() || identity.expression,
        surface: identity.surface || identity.expression,
        meanings: snapshot.meanings.map((meaning) => meaning.trim()).filter(Boolean),
        partOfSpeech: snapshot.partOfSpeech.map((part) => part.trim()).filter(Boolean),
        id: identity.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const nextStore: SavedVocabularyStore = {
        schemaVersion: VOCABULARY_SCHEMA_VERSION,
        entries: { ...store.entries, [entry.id]: entry },
      };
      try {
        await this.storage.set(VOCABULARY_STORAGE_KEY, nextStore);
      } catch (error) {
        throw new VocabularyStorageError('Unable to save vocabulary.', error);
      }
      return entry;
    });
  }

  public remove(id: string): Promise<void> {
    return this.enqueue(async () => {
      const store = await this.readStore();
      if (!store.entries[id]) return;
      const entries = { ...store.entries };
      delete entries[id];
      try {
        await this.storage.set(VOCABULARY_STORAGE_KEY, {
          schemaVersion: VOCABULARY_SCHEMA_VERSION,
          entries,
        } satisfies SavedVocabularyStore);
      } catch (error) {
        throw new VocabularyStorageError('Unable to remove vocabulary.', error);
      }
    });
  }

  public isSaved(input: VocabularyIdentityInput): Promise<boolean> {
    return this.enqueue(async () => {
      const identity = createVocabularyIdentity(input);
      return !!(await this.readStore()).entries[identity.id];
    });
  }
}

export function createChromeVocabularyStorageArea(): VocabularyStorageArea {
  return {
    get: (key) => new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        reject(new VocabularyStorageError('Chrome local storage is unavailable.'));
        return;
      }
      chrome.storage.local.get([key], (result) => {
        const error = chrome.runtime?.lastError;
        if (error) reject(new VocabularyStorageError(error.message ?? 'Chrome storage read failed.'));
        else resolve(result[key]);
      });
    }),
    set: (key, value) => new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        reject(new VocabularyStorageError('Chrome local storage is unavailable.'));
        return;
      }
      chrome.storage.local.set({ [key]: value }, () => {
        const error = chrome.runtime?.lastError;
        if (error) reject(new VocabularyStorageError(error.message ?? 'Chrome storage write failed.'));
        else resolve();
      });
    }),
  };
}
