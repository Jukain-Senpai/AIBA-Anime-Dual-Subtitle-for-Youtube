import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DictionaryService } from '../src/japanese/dictionary.ts';

test('packaged JMdict definitions remain available independently of JLPT', async () => {
  const path = fileURLToPath(new URL('../public/dict/jmdict-eng-common.json', import.meta.url));
  const data = JSON.parse(await readFile(path, 'utf8'));
  const previousFetch = globalThis.fetch;
  Object.assign(globalThis, {
    fetch: async () => ({ ok: true, json: async () => data }),
  });

  try {
    const dictionary = new DictionaryService();
    await dictionary.ensureLoaded();
    assert.equal(dictionary.isLoaded(), true);
    assert.match(dictionary.lookup('学生')?.meanings[0] ?? '', /student/i);
    assert.equal(dictionary.lookup('学生')?.reading, 'がくせい');
  } finally {
    Object.assign(globalThis, { fetch: previousFetch });
  }
});
