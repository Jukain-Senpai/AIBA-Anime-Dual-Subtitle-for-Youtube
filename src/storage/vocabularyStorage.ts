import type { SavedVocabulary, VocabularyDraft } from '../types/vocabulary';
import { createVocabularyIdentity, type VocabularyIdentityInput } from './vocabularyIdentity.ts';
import {
  VOCABULARY_MESSAGE_NAMESPACE,
  type VocabularyRequest,
  type VocabularyResponse,
} from './vocabularyMessages.ts';
import {
  decodeVocabularyStore,
  VOCABULARY_STORAGE_KEY,
  VocabularyStorageError,
} from './vocabularyRepository.ts';

export interface VocabularySnapshot {
  entries: SavedVocabulary[];
  error: VocabularyStorageError | null;
}

export interface VocabularyStorageClient {
  getAll(): Promise<SavedVocabulary[]>;
  save(draft: VocabularyDraft): Promise<SavedVocabulary>;
  remove(id: string): Promise<void>;
  isSaved(expression: string, reading: string, surface?: string): Promise<boolean>;
  subscribe(callback: (snapshot: VocabularySnapshot) => void): () => void;
}

async function sendRequest(request: VocabularyRequest): Promise<unknown> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    throw new VocabularyStorageError('AIBA background storage service is unavailable.');
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(request, (response: VocabularyResponse | undefined) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new VocabularyStorageError(runtimeError.message ?? 'AIBA background storage request failed.'));
      } else if (!response) {
        reject(new VocabularyStorageError('AIBA background storage service did not respond.'));
      } else if (!response.ok) {
        reject(new VocabularyStorageError(response.error));
      } else {
        resolve(response.value);
      }
    });
  });
}

export async function getSavedVocabulary(): Promise<SavedVocabulary[]> {
  return await sendRequest({ namespace: VOCABULARY_MESSAGE_NAMESPACE, action: 'getAll' }) as SavedVocabulary[];
}

export async function saveVocabulary(draft: VocabularyDraft): Promise<SavedVocabulary> {
  return await sendRequest({ namespace: VOCABULARY_MESSAGE_NAMESPACE, action: 'save', draft }) as SavedVocabulary;
}

export async function removeVocabulary(id: string): Promise<void> {
  await sendRequest({ namespace: VOCABULARY_MESSAGE_NAMESPACE, action: 'remove', id });
}

export async function isVocabularySaved(
  expression: string,
  reading: string,
  surface?: string,
): Promise<boolean> {
  const identity: VocabularyIdentityInput = { expression, reading, surface };
  // Validate through the shared identity function before crossing contexts.
  createVocabularyIdentity(identity);
  return await sendRequest({ namespace: VOCABULARY_MESSAGE_NAMESPACE, action: 'isSaved', identity }) as boolean;
}

export function onSavedVocabularyChange(
  callback: (snapshot: VocabularySnapshot) => void,
): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return () => {};

  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local' || !changes[VOCABULARY_STORAGE_KEY]) return;
    try {
      const store = decodeVocabularyStore(changes[VOCABULARY_STORAGE_KEY].newValue);
      const entries = Object.values(store.entries)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
      callback({ entries, error: null });
    } catch (error) {
      callback({
        entries: [],
        error: error instanceof VocabularyStorageError
          ? error
          : new VocabularyStorageError('Unable to synchronize saved vocabulary.', error),
      });
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export const vocabularyStorageClient: VocabularyStorageClient = {
  getAll: getSavedVocabulary,
  save: saveVocabulary,
  remove: removeVocabulary,
  isSaved: isVocabularySaved,
  subscribe: onSavedVocabularyChange,
};
