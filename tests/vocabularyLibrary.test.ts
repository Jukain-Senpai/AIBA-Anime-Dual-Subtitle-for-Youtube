import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SavedVocabulary } from '../src/types/vocabulary.ts';
import {
  formatSavedDate,
  getVocabularyLibraryState,
  removeVocabularyFromList,
  selectSavedVocabulary,
  summarizeMeanings,
} from '../src/popup/vocabularyViewModel.ts';

function entry(overrides: Partial<SavedVocabulary> = {}): SavedVocabulary {
  return {
    id: 'study',
    expression: '勉強',
    reading: 'べんきょう',
    baseForm: '勉強',
    surface: '勉強した',
    meanings: ['study', 'learning'],
    partOfSpeech: ['noun'],
    jlptLevel: 'N4',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

const entries = [
  entry(),
  entry({
    id: 'student', expression: '学生', reading: 'がくせい', baseForm: '学生', surface: '学生',
    meanings: ['student'], jlptLevel: 'N5', createdAt: '2026-10-02T10:00:00.000Z',
  }),
  entry({
    id: 'mystery', expression: '未知語', reading: '', baseForm: '未知語', surface: '未知語',
    meanings: [], jlptLevel: null, createdAt: '2026-09-30T10:00:00.000Z',
  }),
];

test('library defaults to recently saved order', () => {
  assert.deepEqual(selectSavedVocabulary(entries, '', 'ALL').map((item) => item.id), [
    'student', 'study', 'mystery',
  ]);
});

test('searches expression, reading, surface, and English meanings', () => {
  assert.deepEqual(selectSavedVocabulary(entries, '学生', 'ALL').map((item) => item.id), ['student']);
  assert.deepEqual(selectSavedVocabulary(entries, 'べんきょう', 'ALL').map((item) => item.id), ['study']);
  assert.deepEqual(selectSavedVocabulary(entries, 'learning', 'ALL').map((item) => item.id), ['study']);
  assert.deepEqual(selectSavedVocabulary(entries, '勉強した', 'ALL').map((item) => item.id), ['study']);
});

test('filters known and unknown JLPT levels', () => {
  assert.deepEqual(selectSavedVocabulary(entries, '', 'N5').map((item) => item.id), ['student']);
  assert.deepEqual(selectSavedVocabulary(entries, '', 'UNKNOWN').map((item) => item.id), ['mystery']);
  assert.deepEqual(selectSavedVocabulary(entries, 'student', 'N4'), []);
});

test('removal returns a new collection without mutating the source', () => {
  const result = removeVocabularyFromList(entries, 'student');
  assert.deepEqual(result.map((item) => item.id), ['study', 'mystery']);
  assert.equal(entries.length, 3);
});

test('derives loading, error, empty, no-results, and ready states', () => {
  assert.equal(getVocabularyLibraryState(true, null, 0, 0), 'loading');
  assert.equal(getVocabularyLibraryState(false, 'failed', 0, 0), 'error');
  assert.equal(getVocabularyLibraryState(false, null, 0, 0), 'empty');
  assert.equal(getVocabularyLibraryState(false, null, 3, 0), 'no-results');
  assert.equal(getVocabularyLibraryState(false, null, 3, 2), 'ready');
});

test('summaries stay compact without changing source definitions', () => {
  const meanings = ['a very long first definition', 'a second long definition'];
  assert.equal(summarizeMeanings([], 20), 'No definition available');
  assert.equal(summarizeMeanings(meanings, 20), 'a very long first d…');
  assert.deepEqual(meanings, ['a very long first definition', 'a second long definition']);
});

test('formats valid saved dates and handles invalid timestamps', () => {
  assert.equal(formatSavedDate('2026-10-02T00:00:00.000Z', 'en-GB'), '02 Oct 2026');
  assert.equal(formatSavedDate('not-a-date'), 'Unknown date');
});
