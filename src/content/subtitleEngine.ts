import { SubtitleItem } from '../types/subtitle';

/**
 * Subtitle Lookup Engine
 * Performs efficient matching of video currentTime + offset against sorted SubtitleItem array.
 */
export function findActiveSubtitle(
  subtitles: SubtitleItem[],
  currentTime: number,
  offset: number = 0
): SubtitleItem | null {
  if (!subtitles || subtitles.length === 0) return null;

  const adjustedTime = currentTime + offset;

  let low = 0;
  let high = subtitles.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const sub = subtitles[mid];

    if (adjustedTime >= sub.startTime && adjustedTime <= sub.endTime) {
      return sub;
    }

    if (adjustedTime < sub.startTime) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return null;
}
