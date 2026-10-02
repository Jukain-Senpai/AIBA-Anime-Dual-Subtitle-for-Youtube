import {
  VOCABULARY_SCHEMA_VERSION,
  type SavedVocabulary,
  type VocabularyExport,
} from '../types/vocabulary.ts';

export function createVocabularyExport(
  entries: readonly SavedVocabulary[],
  exportedAt = new Date(),
): VocabularyExport {
  return {
    schemaVersion: VOCABULARY_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    entries: entries.map((entry) => ({
      ...entry,
      meanings: [...entry.meanings],
      partOfSpeech: [...entry.partOfSpeech],
      source: entry.source ? { ...entry.source } : undefined,
    })),
  };
}

export function serializeVocabularyExport(payload: VocabularyExport): string {
  return JSON.stringify(payload, null, 2);
}

export function createVocabularyExportFilename(exportedAt = new Date()): string {
  return `aiba-vocabulary-export-${exportedAt.toISOString().slice(0, 10)}.json`;
}

export function downloadVocabularyExport(
  entries: readonly SavedVocabulary[],
  exportedAt = new Date(),
): string {
  const payload = createVocabularyExport(entries, exportedAt);
  const blob = new Blob([serializeVocabularyExport(payload)], { type: 'application/json;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = createVocabularyExportFilename(exportedAt);
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  return filename;
}
