import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VocabularyDraft } from '../src/types/vocabulary';
import {
  VOCABULARY_STORAGE_KEY,
  VocabularyRepository,
  VocabularyStorageError,
  type VocabularyStorageArea,
} from '../src/storage/vocabularyRepository.ts';

class MemoryStorage implements VocabularyStorageArea {
  public values = new Map<string, unknown>();
  public failGet = false;
  public failSet = false;

  async get(key: string): Promise<unknown> {
    await Promise.resolve();
    if (this.failGet) throw new Error('read denied');
    return structuredClone(this.values.get(key));
  }

  async set(key: string, value: unknown): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1));
    if (this.failSet) throw new Error('quota exceeded');
    this.values.set(key, structuredClone(value));
  }
}

function draft(overrides: Partial<VocabularyDraft> = {}): VocabularyDraft {
  return {
    expression: '勉強',
    reading: 'べんきょう',
    baseForm: '勉強',
    surface: '勉強した',
    meanings: ['study', 'learning'],
    partOfSpeech: ['noun'],
    jlptLevel: 'N4',
    ...overrides,
  };
}

test('saves a word and preserves it across repository recreation', async () => {
  const storage = new MemoryStorage();
  const first = new VocabularyRepository(storage, () => '2026-10-02T00:00:00.000Z');
  const saved = await first.save(draft());
  const reloaded = new VocabularyRepository(storage);

  assert.equal((await reloaded.getAll())[0].id, saved.id);
  assert.equal((storage.values.get(VOCABULARY_STORAGE_KEY) as { schemaVersion: number }).schemaVersion, 1);
});

test('deduplicates inflected surfaces through canonical expression and reading', async () => {
  const repository = new VocabularyRepository(new MemoryStorage());
  const first = await repository.save(draft({ surface: '勉強した' }));
  const second = await repository.save(draft({ surface: '勉強している' }));

  assert.equal(first.id, second.id);
  assert.equal((await repository.getAll()).length, 1);
  assert.equal((await repository.getAll())[0].surface, '勉強した');
});

test('preserves the first source occurrence when a duplicate is saved', async () => {
  const repository = new VocabularyRepository(new MemoryStorage());
  const first = await repository.save(draft({
    source: { videoId: 'dQw4w9WgXcQ', videoTitle: 'First lesson', timestamp: 12, subtitleText: '勉強した' },
  }));
  const duplicate = await repository.save(draft({
    surface: '勉強している',
    source: { videoId: 'aqz-KE-bpKQ', videoTitle: 'Second lesson', timestamp: 90 },
  }));
  assert.equal(duplicate.id, first.id);
  assert.deepEqual(duplicate.source, first.source);
  assert.equal((await repository.getAll()).length, 1);
});

test('distinguishes identical expressions with different readings', async () => {
  const repository = new VocabularyRepository(new MemoryStorage());
  await repository.save(draft({ expression: '今日', baseForm: '今日', surface: '今日', reading: 'きょう' }));
  await repository.save(draft({ expression: '今日', baseForm: '今日', surface: '今日', reading: 'こんにち' }));
  assert.equal((await repository.getAll()).length, 2);
});

test('serializes concurrent mutations from the background authority', async () => {
  const repository = new VocabularyRepository(new MemoryStorage());
  const [study, student] = await Promise.all([
    repository.save(draft()),
    repository.save(draft({ expression: '学生', baseForm: '学生', surface: '学生', reading: 'がくせい' })),
  ]);
  await Promise.all([
    repository.remove(study.id),
    repository.save(draft({ expression: '先生', baseForm: '先生', surface: '先生', reading: 'せんせい' })),
  ]);

  const ids = (await repository.getAll()).map((entry) => entry.id);
  assert.deepEqual(new Set(ids), new Set([student.id, (await repository.save(draft({ expression: '先生', baseForm: '先生', surface: '先生', reading: 'せんせい' }))).id]));
});

test('removing a nonexistent word is an idempotent no-op', async () => {
  const repository = new VocabularyRepository(new MemoryStorage());
  await repository.remove('v1:not-present');
  assert.deepEqual(await repository.getAll(), []);
});

test('surfaces storage read and write failures without discarding committed data', async () => {
  const storage = new MemoryStorage();
  const repository = new VocabularyRepository(storage);
  await repository.save(draft());
  storage.failSet = true;
  await assert.rejects(
    repository.save(draft({ expression: '学生', baseForm: '学生', surface: '学生', reading: 'がくせい' })),
    VocabularyStorageError,
  );
  storage.failSet = false;
  assert.equal((await repository.getAll()).length, 1);
  storage.failGet = true;
  await assert.rejects(repository.getAll(), VocabularyStorageError);
});
