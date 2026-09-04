/**
 * Checks if a string contains any Kanji characters.
 * Matches CJK Unified Ideographs block.
 */
export function hasKanji(text: string): boolean {
  return /[\u4e00-\u9faf]/.test(text);
}

/**
 * Converts katakana string to hiragana.
 * Used for formatting Kuromoji readings (which are katakana by default) into standard furigana (hiragana).
 */
export function katakanaToHiragana(katakana: string): string {
  return katakana.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}
