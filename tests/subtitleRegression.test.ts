import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseSRT } from '../src/utils/srtParser.ts';
import { findActiveSubtitle } from '../src/content/subtitleEngine.ts';

test('the supplied SRT still parses into ordered subtitles', async () => {
  const samplePath = fileURLToPath(new URL('../sample_japanese.srt', import.meta.url));
  const subtitles = parseSRT(await readFile(samplePath, 'utf8'));

  assert.equal(subtitles.length, 4);
  assert.deepEqual(subtitles.map(({ startTime, endTime }) => [startTime, endTime]), [
    [2, 5.5], [6, 9.5], [10, 14], [15, 19],
  ]);
  assert.match(subtitles[0].text, /こんにちは/);
});

test('subtitle lookup stays correct through seeks, gaps, and sync offset', () => {
  const subtitles = parseSRT('1\n00:00:02,000 --> 00:00:05,500\n学生\n\n2\n00:00:06,000 --> 00:00:09,500\n先生');

  assert.equal(findActiveSubtitle(subtitles, 2.5)?.text, '学生');
  assert.equal(findActiveSubtitle(subtitles, 5.75), null);
  assert.equal(findActiveSubtitle(subtitles, 7)?.text, '先生');
  assert.equal(findActiveSubtitle(subtitles, 2.5)?.text, '学生');
  assert.equal(findActiveSubtitle(subtitles, 1.5, 1)?.text, '学生');
  assert.equal(findActiveSubtitle(subtitles, 10), null);
});
