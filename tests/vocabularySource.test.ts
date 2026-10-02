import assert from 'node:assert/strict';
import { test } from 'node:test';
import { YouTubePlayerObserver } from '../src/content/youtubePlayer.ts';
import {
  buildYouTubeSourceUrl,
  extractYouTubeVideoId,
  normalizeVocabularySource,
} from '../src/vocabulary/youtubeSource.ts';

test('extracts validated IDs from supported YouTube URL shapes', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=abc'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ?feature=share'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=10'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(extractYouTubeVideoId('not a URL'), null);
});

test('normalizes source metadata and rejects unsafe source values', () => {
  assert.deepEqual(normalizeVocabularySource({
    videoId: 'dQw4w9WgXcQ', videoTitle: '  Lesson  ', timestamp: 12.34567, subtitleText: '  日本語  ',
  }), {
    videoId: 'dQw4w9WgXcQ', videoTitle: 'Lesson', timestamp: 12.346, subtitleText: '日本語',
  });
  assert.equal(normalizeVocabularySource({ videoId: '../bad', timestamp: 10 }), undefined);
  assert.equal(normalizeVocabularySource({ videoId: 'dQw4w9WgXcQ', timestamp: Number.NaN }), undefined);
});

test('builds an encoded canonical source URL with a safe timestamp', () => {
  assert.equal(
    buildYouTubeSourceUrl({ videoId: 'dQw4w9WgXcQ', timestamp: 125.9 }),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=125s',
  );
  assert.equal(buildYouTubeSourceUrl({ videoId: 'invalid!', timestamp: 10 }), null);
});

test('player observer captures the current video context without a second detector', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  Object.assign(globalThis, {
    window: { location: { href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
    document: {
      title: 'Fallback title - YouTube',
      querySelector: () => ({ textContent: '  Japanese Lesson  ' }),
    },
  });
  try {
    const observer = Object.create(YouTubePlayerObserver.prototype) as YouTubePlayerObserver;
    Object.assign(observer, { videoElement: { currentTime: 42.1236 } });
    assert.deepEqual(observer.getVocabularySource('  日本語を勉強する  '), {
      videoId: 'dQw4w9WgXcQ',
      videoTitle: 'Japanese Lesson',
      timestamp: 42.124,
      subtitleText: '日本語を勉強する',
    });
  } finally {
    Object.assign(globalThis, { window: previousWindow, document: previousDocument });
  }
});
