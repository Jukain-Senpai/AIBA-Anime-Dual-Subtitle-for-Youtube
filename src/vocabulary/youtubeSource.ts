import type { VocabularySource } from '../types/vocabulary';

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function isValidYouTubeVideoId(value: string): boolean {
  return YOUTUBE_VIDEO_ID.test(value);
}

export function normalizeVocabularySource(
  source: VocabularySource | undefined,
): VocabularySource | undefined {
  if (!source || !isValidYouTubeVideoId(source.videoId) || !Number.isFinite(source.timestamp)) {
    return undefined;
  }
  const videoTitle = source.videoTitle?.normalize('NFKC').trim().slice(0, 300);
  const subtitleText = source.subtitleText?.normalize('NFKC').trim().slice(0, 1000);
  return {
    videoId: source.videoId,
    ...(videoTitle ? { videoTitle } : {}),
    timestamp: Math.max(0, Number(source.timestamp.toFixed(3))),
    ...(subtitleText ? { subtitleText } : {}),
  };
}

export function extractYouTubeVideoId(urlValue: string): string | null {
  try {
    const url = new URL(urlValue);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    let candidate = '';
    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      if (url.pathname === '/watch') candidate = url.searchParams.get('v') ?? '';
      else {
        const match = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/);
        candidate = match?.[1] ?? '';
      }
    } else if (hostname === 'youtu.be') {
      candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
    }
    return isValidYouTubeVideoId(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function buildYouTubeSourceUrl(source: VocabularySource | undefined): string | null {
  if (!source || !isValidYouTubeVideoId(source.videoId)) return null;
  const url = new URL('https://www.youtube.com/watch');
  url.searchParams.set('v', source.videoId);
  const timestamp = Number.isFinite(source.timestamp) ? Math.max(0, Math.floor(source.timestamp)) : 0;
  if (timestamp > 0) url.searchParams.set('t', `${timestamp}s`);
  return url.toString();
}
