import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enrichTokensWithJLPT } from '../src/japanese/tokenEnrichment.ts';
import type { JapaneseToken } from '../src/japanese/types.ts';

function token(surface: string, baseForm = surface, reading = '', partOfSpeech = '名詞'): JapaneseToken {
  return { surface, baseForm, reading, partOfSpeech, startIndex: 0, endIndex: surface.length };
}

test('enriches inflected tokens without changing their boundaries or source objects', () => {
  const original = [token('食べました', '食べる', 'タベル', '動詞')];
  const calls: string[][] = [];
  const enriched = enrichTokensWithJLPT(original, {
    lookup(baseForm, reading, surface) {
      calls.push([baseForm, reading, surface]);
      return 'N5';
    },
  });

  assert.deepEqual(calls, [['食べる', 'タベル', '食べました']]);
  assert.deepEqual(enriched[0], { ...original[0], jlptLevel: 'N5' });
  assert.equal(original[0].jlptLevel, undefined);
});

test('leaves punctuation unclassified and preserves unknown words', () => {
  const calls: string[] = [];
  const enriched = enrichTokensWithJLPT(
    [token('。', '。', '', '記号'), token('！'), token('未知語')],
    {
      lookup(baseForm) {
        calls.push(baseForm);
        return null;
      },
    },
  );

  assert.deepEqual(calls, ['未知語']);
  assert.deepEqual(enriched.map((item) => item.jlptLevel), [null, null, null]);
});
