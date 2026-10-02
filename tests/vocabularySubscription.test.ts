import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onSavedVocabularyChange } from '../src/storage/vocabularyStorage.ts';
import { VOCABULARY_STORAGE_KEY } from '../src/storage/vocabularyRepository.ts';

test('broadcasts committed vocabulary snapshots and supports unsubscribe', () => {
  const previousChrome = globalThis.chrome;
  let listener: ((changes: Record<string, { newValue: unknown }>, area: string) => void) | undefined;
  const chromeMock = {
    storage: {
      onChanged: {
        addListener(callback: typeof listener) { listener = callback; },
        removeListener() { listener = undefined; },
      },
    },
  };
  Object.assign(globalThis, { chrome: chromeMock });

  try {
    let count = -1;
    const unsubscribe = onSavedVocabularyChange(({ entries, error }) => {
      assert.equal(error, null);
      count = entries.length;
    });
    listener?.({
      [VOCABULARY_STORAGE_KEY]: {
        newValue: {
          schemaVersion: 1,
          entries: {
            word: {
              id: 'word', expression: '語', reading: 'ご', baseForm: '語', surface: '語',
              meanings: [], partOfSpeech: [], jlptLevel: null,
              createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z',
            },
          },
        },
      },
    }, 'local');
    assert.equal(count, 1);
    unsubscribe();
    assert.equal(listener, undefined);
  } finally {
    Object.assign(globalThis, { chrome: previousChrome });
  }
});
