import type { SavedVocabulary, VocabularyDraft } from '../types/vocabulary';

export const VOCABULARY_MESSAGE_NAMESPACE = 'AIBA_VOCABULARY_V1' as const;

export type VocabularyRequest =
  | { namespace: typeof VOCABULARY_MESSAGE_NAMESPACE; action: 'getAll' }
  | { namespace: typeof VOCABULARY_MESSAGE_NAMESPACE; action: 'save'; draft: VocabularyDraft }
  | { namespace: typeof VOCABULARY_MESSAGE_NAMESPACE; action: 'remove'; id: string }
  | {
      namespace: typeof VOCABULARY_MESSAGE_NAMESPACE;
      action: 'isSaved';
      identity: { expression: string; reading: string; surface?: string };
    };

export type VocabularyResponse =
  | { ok: true; value: SavedVocabulary[] | SavedVocabulary | boolean | null }
  | { ok: false; error: string };

export function isVocabularyRequest(value: unknown): value is VocabularyRequest {
  return !!value && typeof value === 'object' &&
    (value as { namespace?: unknown }).namespace === VOCABULARY_MESSAGE_NAMESPACE;
}
