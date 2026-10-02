import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SavedVocabulary } from '../src/types/vocabulary.ts';
import {
  createVocabularyExport,
  createVocabularyExportFilename,
  downloadVocabularyExport,
  serializeVocabularyExport,
} from '../src/vocabulary/exportVocabulary.ts';

const entries: SavedVocabulary[] = [
  {
    id: 'student', expression: '学生', reading: 'がくせい', baseForm: '学生', surface: '学生',
    meanings: ['student'], partOfSpeech: ['noun'], jlptLevel: 'N5',
    source: { videoId: 'dQw4w9WgXcQ', videoTitle: '日本語 Lesson', timestamp: 125, subtitleText: '学生です' },
    createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z',
  },
  {
    id: 'unknown', expression: '未知語', reading: '', baseForm: '未知語', surface: '未知語',
    meanings: [], partOfSpeech: [], jlptLevel: null,
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

test('export includes every entry with schema and timestamp', () => {
  const date = new Date('2026-10-02T12:34:56.000Z');
  const payload = createVocabularyExport(entries, date);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.exportedAt, '2026-10-02T12:34:56.000Z');
  assert.deepEqual(payload.entries.map((entry) => entry.id), ['student', 'unknown']);
  assert.equal(createVocabularyExportFilename(date), 'aiba-vocabulary-export-2026-10-02.json');
});

test('download creates a local UTF-8 JSON file containing the full collection', () => {
  const previousDocument = globalThis.document;
  const previousUrl = globalThis.URL;
  let clicked = false;
  let revoked = '';
  let appended = false;
  const link = {
    href: '', download: '', style: { display: '' },
    click() { clicked = true; },
    remove() {},
  };
  Object.assign(globalThis, {
    URL: {
      createObjectURL(blob: Blob) {
        assert.equal(blob.type, 'application/json;charset=utf-8');
        return 'blob:aiba-export';
      },
      revokeObjectURL(value: string) { revoked = value; },
    },
    document: {
      createElement: () => link,
      body: { appendChild() { appended = true; } },
    },
  });
  try {
    const filename = downloadVocabularyExport(entries, new Date('2026-10-02T00:00:00.000Z'));
    assert.equal(filename, 'aiba-vocabulary-export-2026-10-02.json');
    assert.equal(link.download, filename);
    assert.equal(link.href, 'blob:aiba-export');
    assert.equal(appended, true);
    assert.equal(clicked, true);
    assert.equal(revoked, 'blob:aiba-export');
  } finally {
    Object.assign(globalThis, { document: previousDocument, URL: previousUrl });
  }
});

test('serialized export preserves Japanese and does not alias source data', () => {
  const payload = createVocabularyExport(entries, new Date('2026-10-02T00:00:00.000Z'));
  const json = serializeVocabularyExport(payload);
  assert.match(json, /学生/);
  assert.match(json, /日本語 Lesson/);
  payload.entries[0].meanings.push('learner');
  assert.deepEqual(entries[0].meanings, ['student']);
});
