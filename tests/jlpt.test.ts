import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { JLPTService } from '../src/japanese/jlpt.ts';

const assetPath = fileURLToPath(new URL('../public/jlpt/jlpt-vocab.json', import.meta.url));

function responseFor(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return data;
    },
  };
}

async function productionService() {
  const data = JSON.parse(await readFile(assetPath, 'utf8'));
  const service = new JLPTService({ fetcher: async () => responseFor(data) });
  await service.ensureLoaded();
  return { service, data };
}

test('packaged dataset preserves the pinned source counts and unique IDs', async () => {
  const { data } = await productionService();
  assert.deepEqual(data.metadata.counts, {
    N5: 674,
    N4: 630,
    N3: 1659,
    N2: 1778,
    N1: 3070,
    total: 7811,
  });
  assert.equal(data.entries.length, 7811);
  assert.equal(new Set(data.entries.map((entry: { id: string }) => entry.id)).size, 7811);
});

test('looks up verified vocabulary across N5 through N1', async () => {
  const { service } = await productionService();
  assert.equal(service.lookup('食べる', 'タベル'), 'N5');
  assert.equal(service.lookup('経済', 'けいざい'), 'N4');
  assert.equal(service.lookup('改善', 'カイゼン'), 'N3');
  assert.equal(service.lookup('足跡', 'あしあと'), 'N2');
  assert.equal(service.lookup('憂鬱', 'ゆううつ'), 'N1');
});

test('uses the base form for inflected surfaces and supports kana-only words', async () => {
  const { service } = await productionService();
  assert.equal(service.lookup('食べる', 'タベル', '食べました'), 'N5');
  assert.equal(service.lookup('あさって', 'アサッテ'), 'N5');
  assert.equal(service.lookup('明後日', 'あさって'), 'N5');
});

test('returns null for unknown vocabulary and never matches by reading alone', async () => {
  const { service } = await productionService();
  assert.equal(service.lookup('存在しない語', 'そんざいしないご'), null);
  assert.equal(service.lookup('', 'こうしょう'), null);
});

test('requires an exact reading when an expression is ambiguous', async () => {
  const fixture = {
    metadata: { counts: { N5: 1, N4: 1, N3: 0, N2: 0, N1: 0, total: 2 } },
    entries: [
      { id: 'one', expression: '人気', reading: 'にんき', level: 'N5' },
      { id: 'two', expression: '人気', reading: 'ひとけ', level: 'N4' },
    ],
  };
  const service = new JLPTService({ fetcher: async () => responseFor(fixture) });
  await service.ensureLoaded();

  assert.equal(service.lookup('人気', 'にんき'), 'N5');
  assert.equal(service.lookup('人気', 'ひとけ'), 'N4');
  assert.equal(service.lookup('人気'), null);
  assert.equal(service.lookup('人気', 'じんき'), null);
});

test('does not combine alternate forms and alternate readings', async () => {
  const fixture = {
    metadata: { counts: { N5: 1, N4: 1, N3: 0, N2: 0, N1: 0, total: 2 } },
    entries: [
      {
        id: 'alternate',
        expression: '四',
        reading: 'よん',
        level: 'N5',
        other_forms: ['肆'],
        other_readings: ['し'],
      },
      { id: 'other-entry', expression: '肆', reading: 'たい', level: 'N4' },
    ],
  };
  const service = new JLPTService({ fetcher: async () => responseFor(fixture) });
  await service.ensureLoaded();

  assert.equal(service.lookup('四', 'よん'), 'N5');
  assert.equal(service.lookup('四', 'し'), 'N5');
  assert.equal(service.lookup('肆', 'よん'), 'N5');
  assert.equal(service.lookup('肆', 'たい'), 'N4');
  assert.equal(service.lookup('肆', 'し'), null);
});

test('concurrent initialization fetches and parses the dataset once', async () => {
  let fetchCount = 0;
  const fixture = {
    metadata: { counts: { N5: 1, N4: 0, N3: 0, N2: 0, N1: 0, total: 1 } },
    entries: [{ id: 'one', expression: '学生', reading: 'がくせい', level: 'N5' }],
  };
  const service = new JLPTService({
    fetcher: async () => {
      fetchCount += 1;
      await Promise.resolve();
      return responseFor(fixture);
    },
  });

  await Promise.all([service.ensureLoaded(), service.ensureLoaded(), service.ensureLoaded()]);
  assert.equal(fetchCount, 1);
  assert.equal(service.isLoaded(), true);
});

test('load failure is contained and leaves lookups safely unclassified', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const service = new JLPTService({
      fetcher: async () => {
        throw new Error('offline');
      },
    });
    await assert.doesNotReject(service.ensureLoaded());
    assert.equal(service.isLoaded(), false);
    assert.match(service.getLoadError()?.message ?? '', /offline/);
    assert.equal(service.lookup('学生', 'がくせい'), null);
  } finally {
    console.warn = originalWarn;
  }
});
