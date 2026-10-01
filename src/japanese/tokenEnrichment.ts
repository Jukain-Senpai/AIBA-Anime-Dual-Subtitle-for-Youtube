import type { JLPTService } from './jlpt';
import type { JapaneseToken } from './types';

const punctuationOnly = /^[\p{P}\p{S}\s]+$/u;

/** Add classification after tokenization, without changing Kuromoji's token boundaries. */
export function enrichTokensWithJLPT(
  tokens: JapaneseToken[],
  jlptService: Pick<JLPTService, 'lookup'>,
): JapaneseToken[] {
  return tokens.map((token) => ({
    ...token,
    jlptLevel:
      token.partOfSpeech === '記号' || punctuationOnly.test(token.surface)
        ? null
        : jlptService.lookup(token.baseForm, token.reading, token.surface),
  }));
}
