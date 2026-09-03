export interface JapaneseToken {
  surface: string;
  reading: string;
  baseForm: string;
  partOfSpeech: string;
  startIndex: number;
  endIndex: number;
}

export interface DictionaryEntry {
  expression: string;
  reading: string;
  meanings: string[];
  partOfSpeech?: string[];
}
