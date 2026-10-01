import type { JLPTKnownLevel } from './jlpt';

export const JLPT_LEVELS: readonly JLPTKnownLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

export const JLPT_COLORS: Readonly<Record<JLPTKnownLevel, string>> = {
  N5: '#4CAF50',
  N4: '#42A5F5',
  N3: '#FFD54F',
  N2: '#FF9800',
  N1: '#EF5350',
};
