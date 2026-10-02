import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createVocabularyIdentity,
  normalizeVocabularyReading,
} from '../src/storage/vocabularyIdentity.ts';

test('normalizes width and kana consistently for vocabulary identity', () => {
  assert.equal(normalizeVocabularyReading(' ベンキョウ '), 'べんきょう');
  assert.equal(
    createVocabularyIdentity({ expression: '勉強', reading: 'ベンキョウ', surface: '勉強した' }).id,
    createVocabularyIdentity({ expression: '勉強', reading: 'べんきょう', surface: '勉強する' }).id,
  );
});

test('canonical dictionary expression prevents alternate surface duplicates', () => {
  const primary = createVocabularyIdentity({ expression: '為る', reading: 'する', surface: 'する' });
  const alternate = createVocabularyIdentity({ expression: '為る', reading: 'スル', surface: '為る' });
  assert.equal(primary.id, alternate.id);
});

test('homographs with distinct readings stay separate', () => {
  const today = createVocabularyIdentity({ expression: '今日', reading: 'きょう' });
  const formal = createVocabularyIdentity({ expression: '今日', reading: 'こんにち' });
  assert.notEqual(today.id, formal.id);
});

test('unknown readings use surface conservatively', () => {
  const first = createVocabularyIdentity({ expression: '生', reading: '', surface: '生' });
  const second = createVocabularyIdentity({ expression: '生', reading: '', surface: '生もの' });
  assert.notEqual(first.id, second.id);
});

test('empty canonical expressions are rejected', () => {
  assert.throws(() => createVocabularyIdentity({ expression: '  ', reading: 'ことば' }));
});
