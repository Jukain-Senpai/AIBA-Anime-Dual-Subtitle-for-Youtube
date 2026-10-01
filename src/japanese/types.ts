import type { JLPTLevel } from './jlpt';

export interface JapaneseToken {
  surface: string;
  reading: string;
  baseForm: string;
  partOfSpeech: string;
  startIndex: number;
  endIndex: number;
  jlptLevel?: JLPTLevel;
}

export interface DictionaryEntry {
  expression: string;
  reading: string;
  meanings: string[];
  partOfSpeech?: string[];
}
