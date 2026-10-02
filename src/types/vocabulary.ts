import type { JLPTLevel } from '../japanese/jlpt';

export const VOCABULARY_SCHEMA_VERSION = 1 as const;

export interface VocabularySource {
  videoId: string;
  videoTitle?: string;
  timestamp: number;
  subtitleText?: string;
}

export interface VocabularyDraft {
  /** Canonical dictionary expression when available, otherwise the token base form. */
  expression: string;
  reading: string;
  baseForm: string;
  surface: string;
  meanings: string[];
  partOfSpeech: string[];
  jlptLevel: JLPTLevel;
  source?: VocabularySource;
}

export interface SavedVocabulary extends VocabularyDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedVocabularyStore {
  schemaVersion: typeof VOCABULARY_SCHEMA_VERSION;
  entries: Record<string, SavedVocabulary>;
}

export interface VocabularyExport {
  schemaVersion: typeof VOCABULARY_SCHEMA_VERSION;
  exportedAt: string;
  entries: SavedVocabulary[];
}
