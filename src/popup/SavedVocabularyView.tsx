import React, { useEffect, useMemo, useRef, useState } from 'react';
import { JLPT_COLORS, JLPT_LEVELS } from '../japanese/jlptColors';
import type { SavedVocabulary } from '../types/vocabulary';
import {
  getSavedVocabulary,
  onSavedVocabularyChange,
  removeVocabulary,
} from '../storage/vocabularyStorage';
import {
  formatSavedDate,
  getVocabularyLibraryState,
  removeVocabularyFromList,
  selectSavedVocabulary,
  summarizeMeanings,
  type VocabularyLevelFilter,
} from './vocabularyViewModel';
import { buildYouTubeSourceUrl } from '../vocabulary/youtubeSource';
import { downloadVocabularyExport } from '../vocabulary/exportVocabulary';

export const SavedVocabularyView: React.FC = () => {
  const [entries, setEntries] = useState<SavedVocabulary[]>([]);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<VocabularyLevelFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const receivedLiveUpdate = useRef(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = onSavedVocabularyChange((snapshot) => {
      if (!active) return;
      receivedLiveUpdate.current = true;
      setLoading(false);
      setLoadError(snapshot.error?.message ?? null);
      if (!snapshot.error) setEntries(snapshot.entries);
    });

    void getSavedVocabulary().then((saved) => {
      if (!active) return;
      if (!receivedLiveUpdate.current) setEntries(saved);
      setLoading(false);
      setLoadError(null);
    }).catch((loadError: unknown) => {
      if (!active) return;
      setLoading(false);
      setLoadError(loadError instanceof Error ? loadError.message : 'Unable to load saved vocabulary.');
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const visibleEntries = useMemo(
    () => selectSavedVocabulary(entries, query, level),
    [entries, query, level],
  );
  const libraryState = getVocabularyLibraryState(loading, loadError, entries.length, visibleEntries.length);

  const handleRemove = async (entry: SavedVocabulary) => {
    if (removingIds.has(entry.id)) return;
    setRemovingIds((current) => new Set(current).add(entry.id));
    setActionError(null);
    try {
      await removeVocabulary(entry.id);
      setEntries((current) => removeVocabularyFromList(current, entry.id));
    } catch (removeError) {
      setActionError(removeError instanceof Error ? removeError.message : 'Unable to remove saved vocabulary.');
    } finally {
      setRemovingIds((current) => {
        const next = new Set(current);
        next.delete(entry.id);
        return next;
      });
    }
  };

  const handleExport = () => {
    setActionError(null);
    try {
      downloadVocabularyExport(entries);
    } catch (exportError) {
      setActionError(exportError instanceof Error ? exportError.message : 'Unable to export vocabulary.');
    }
  };

  return (
    <section className="vocabulary-library" role="tabpanel" aria-labelledby="saved-vocabulary-tab">
      <div className="vocabulary-heading">
        <div>
          <h2>Saved Vocabulary</h2>
          <p>{entries.length} {entries.length === 1 ? 'word' : 'words'} saved</p>
        </div>
        <div className="vocabulary-heading-actions">
          <span className="vocabulary-count" aria-label={`${entries.length} saved vocabulary entries`}>
            {entries.length}
          </span>
          <button
            type="button"
            className="vocabulary-export"
            onClick={handleExport}
            disabled={loading || entries.length === 0}
          >
            Export JSON
          </button>
        </div>
      </div>

      {actionError && (
        <div className="vocabulary-action-error" role="status">{actionError}</div>
      )}

      <div className="vocabulary-controls">
        <label className="sr-only" htmlFor="vocabulary-search">Search saved vocabulary</label>
        <input
          id="vocabulary-search"
          className="vocabulary-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Japanese, reading, or meaning"
        />
        <label className="sr-only" htmlFor="vocabulary-level-filter">Filter by JLPT level</label>
        <select
          id="vocabulary-level-filter"
          className="vocabulary-filter"
          value={level}
          onChange={(event) => setLevel(event.target.value as VocabularyLevelFilter)}
        >
          <option value="ALL">All levels</option>
          {JLPT_LEVELS.map((jlptLevel) => (
            <option value={jlptLevel} key={jlptLevel}>{jlptLevel}</option>
          ))}
          <option value="UNKNOWN">Unknown</option>
        </select>
      </div>

      {libraryState === 'loading' && (
        <div className="vocabulary-state" role="status">Loading saved vocabulary…</div>
      )}
      {libraryState === 'error' && (
        <div className="vocabulary-state vocabulary-state-error" role="alert">
          <strong>Couldn’t load your vocabulary.</strong>
          <span>{loadError}</span>
        </div>
      )}
      {libraryState === 'empty' && (
        <div className="vocabulary-state">
          <span className="vocabulary-state-icon" aria-hidden="true">☆</span>
          <strong>No saved words yet</strong>
          <span>Click a subtitle word on YouTube, then choose Save Word.</span>
        </div>
      )}
      {libraryState === 'no-results' && (
        <div className="vocabulary-state">
          <strong>No matching words</strong>
          <span>Try another search or JLPT level.</span>
        </div>
      )}
      {libraryState === 'ready' && (
        <div className="vocabulary-list" aria-live="polite">
          {visibleEntries.map((entry) => {
            const removing = removingIds.has(entry.id);
            const sourceUrl = buildYouTubeSourceUrl(entry.source);
            return (
              <article className="vocabulary-card" key={entry.id}>
                <div className="vocabulary-card-header">
                  <div className="vocabulary-word-group">
                    <strong className="vocabulary-expression">{entry.expression}</strong>
                    {entry.reading && <span className="vocabulary-reading">{entry.reading}</span>}
                  </div>
                  <span
                    className={`vocabulary-level ${entry.jlptLevel ? '' : 'vocabulary-level-unknown'}`}
                    style={entry.jlptLevel ? { backgroundColor: JLPT_COLORS[entry.jlptLevel] } : undefined}
                    title={entry.jlptLevel ? 'Approximate JLPT vocabulary level' : 'JLPT level unknown'}
                  >
                    {entry.jlptLevel ?? '?'}
                  </span>
                </div>
                <p className="vocabulary-meaning" title={entry.meanings.join(' / ')}>
                  {summarizeMeanings(entry.meanings)}
                </p>
                <div className="vocabulary-card-footer">
                  <span>Saved {formatSavedDate(entry.createdAt)}</span>
                  <div className="vocabulary-card-actions">
                    {sourceUrl && (
                      <a
                        className="vocabulary-source"
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View ${entry.expression} in its original YouTube video`}
                      >
                        View Source
                      </a>
                    )}
                    <button
                      type="button"
                      className="vocabulary-remove"
                      disabled={removing}
                      onClick={() => void handleRemove(entry)}
                      aria-label={`Remove ${entry.expression} from saved vocabulary`}
                    >
                      {removing ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
