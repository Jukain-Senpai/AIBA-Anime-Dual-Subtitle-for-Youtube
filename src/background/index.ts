import { VOCABULARY_MESSAGE_NAMESPACE, isVocabularyRequest, type VocabularyResponse } from '../storage/vocabularyMessages.ts';
import { createChromeVocabularyStorageArea, VocabularyRepository } from '../storage/vocabularyRepository.ts';

const vocabularyRepository = new VocabularyRepository(createChromeVocabularyStorageArea());

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: VocabularyResponse) => void) => {
  if (!isVocabularyRequest(message)) return false;

  const respond = async (): Promise<VocabularyResponse> => {
    try {
      switch (message.action) {
        case 'getAll':
          return { ok: true, value: await vocabularyRepository.getAll() };
        case 'save':
          return { ok: true, value: await vocabularyRepository.save(message.draft) };
        case 'remove':
          await vocabularyRepository.remove(message.id);
          return { ok: true, value: null };
        case 'isSaved':
          return { ok: true, value: await vocabularyRepository.isSaved(message.identity) };
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown vocabulary storage error.';
      return { ok: false, error: detail };
    }
  };

  void respond().then(sendResponse);
  return true;
});

console.debug(`[AIBA] ${VOCABULARY_MESSAGE_NAMESPACE} background service ready.`);
