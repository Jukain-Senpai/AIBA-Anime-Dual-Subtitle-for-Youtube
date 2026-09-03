import { SubtitleItem } from '../types/subtitle';

/**
 * Parses an SRT timestamp string (e.g. "00:01:23,500" or "00:01:23.500") into seconds.
 */
export function parseTimestamp(timeStr: string): number {
  if (!timeStr) return 0;

  // Standardize comma to dot for milliseconds separator
  const cleanStr = timeStr.trim().replace(',', '.');
  const parts = cleanStr.split(':');

  if (parts.length !== 3) return 0;

  const hours = parseFloat(parts[0]) || 0;
  const minutes = parseFloat(parts[1]) || 0;
  const seconds = parseFloat(parts[2]) || 0;

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Formats seconds into HH:MM:SS or MM:SS string for UI display.
 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const pad = (num: number) => num.toString().padStart(2, '0');

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Parses raw SRT file string content into structured SubtitleItem array.
 */
export function parseSRT(srtContent: string): SubtitleItem[] {
  if (!srtContent || !srtContent.trim()) {
    return [];
  }

  // Normalize line endings to \n
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\n+/);
  const subtitles: SubtitleItem[] = [];

  let idCounter = 1;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // Find the timestamp line containing "-->"
    const timestampLineIndex = lines.findIndex(line => line.includes('-->'));
    if (timestampLineIndex === -1) continue;

    const timestampLine = lines[timestampLineIndex];
    const [startStr, endStr] = timestampLine.split('-->').map(s => s.trim());

    if (!startStr || !endStr) continue;

    const startTime = parseTimestamp(startStr);
    const endTime = parseTimestamp(endStr);

    // Any lines after the timestamp line are part of the subtitle text
    const textLines = lines.slice(timestampLineIndex + 1);
    const text = textLines.join('\n').trim();

    if (text && endTime > startTime) {
      subtitles.push({
        id: idCounter++,
        startTime,
        endTime,
        text,
      });
    }
  }

  return subtitles.sort((a, b) => a.startTime - b.startTime);
}
