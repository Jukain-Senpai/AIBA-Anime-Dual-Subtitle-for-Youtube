export interface VocabularyIdentityInput {
  expression: string;
  reading: string;
  surface?: string;
}

export interface VocabularyIdentity {
  id: string;
  expression: string;
  reading: string;
  surface: string;
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').trim();
}

/** Normalize Japanese readings so equivalent hiragana/katakana keys match. */
export function normalizeVocabularyReading(value: string): string {
  return Array.from(normalizeText(value), (character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && codePoint >= 0x30a1 && codePoint <= 0x30f6) {
      return String.fromCodePoint(codePoint - 0x60);
    }
    return character;
  }).join('');
}

export function normalizeVocabularyExpression(value: string): string {
  return normalizeText(value);
}

/**
 * Build the only bookmark identity used by storage and UI callers.
 *
 * A known reading distinguishes homographs. When the reading is unknown, the
 * clicked surface is retained in the key rather than merging potentially
 * unrelated words. Callers must pass the canonical dictionary expression when
 * available so alternate dictionary spellings resolve to the same bookmark.
 */
export function createVocabularyIdentity(input: VocabularyIdentityInput): VocabularyIdentity {
  const expression = normalizeVocabularyExpression(input.expression);
  const reading = normalizeVocabularyReading(input.reading);
  const surface = normalizeVocabularyExpression(input.surface ?? input.expression);

  if (!expression) {
    throw new Error('Vocabulary expression cannot be empty.');
  }

  const discriminator = reading ? `reading:${reading}` : `unknown:${surface || expression}`;
  return {
    id: `v1:${encodeURIComponent(expression)}|${encodeURIComponent(discriminator)}`,
    expression,
    reading,
    surface,
  };
}
