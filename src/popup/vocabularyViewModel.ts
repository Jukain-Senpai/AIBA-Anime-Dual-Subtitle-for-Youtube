import type { JLPTKnownLevel } from '../japanese/jlpt';
import type { SavedVocabulary } from '../types/vocabulary';

export type VocabularyLevelFilter = 'ALL' | JLPTKnownLevel | 'UNKNOWN';
export type VocabularyLibraryState = 'loading' | 'error' | 'empty' | 'no-results' | 'ready';

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

export function selectSavedVocabulary(
  entries: readonly SavedVocabulary[],
  query: string,
  level: VocabularyLevelFilter,
): SavedVocabulary[] {
  const normalizedQuery = normalizeSearchText(query);
  return entries
    .filter((entry) => {
      if (level === 'UNKNOWN' && entry.jlptLevel !== null) return false;
      if (level !== 'ALL' && level !== 'UNKNOWN' && entry.jlptLevel !== level) return false;
      if (!normalizedQuery) return true;
      const searchable = [entry.expression, entry.reading, entry.baseForm, entry.surface, ...entry.meanings]
        .map(normalizeSearchText);
      return searchable.some((value) => value.includes(normalizedQuery));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

export function removeVocabularyFromList(
  entries: readonly SavedVocabulary[],
  id: string,
): SavedVocabulary[] {
  return entries.filter((entry) => entry.id !== id);
}

export function getVocabularyLibraryState(
  loading: boolean,
  error: string | null,
  totalCount: number,
  visibleCount: number,
): VocabularyLibraryState {
  if (loading) return 'loading';
  if (error) return 'error';
  if (totalCount === 0) return 'empty';
  if (visibleCount === 0) return 'no-results';
  return 'ready';
}

export function summarizeMeanings(meanings: readonly string[], maxLength = 110): string {
  if (meanings.length === 0) return 'No definition available';
  const summary = meanings.slice(0, 2).join(' / ');
  return summary.length <= maxLength ? summary : `${summary.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function formatSavedDate(value: string, locale = 'en-GB'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
