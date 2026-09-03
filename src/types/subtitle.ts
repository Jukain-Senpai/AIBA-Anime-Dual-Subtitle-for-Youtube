export interface SubtitleItem {
  id: number;
  startTime: number; // Start time in seconds
  endTime: number;   // End time in seconds
  text: string;      // Japanese subtitle text content
}

export type SubtitlePosition = 'top' | 'center' | 'bottom' | 'above_yt' | 'below_yt';

export interface SubtitleSettings {
  position: SubtitlePosition;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  textOutline: boolean;
  outlineSize: number;
  lineSpacing: number;
  offset: number;
}

export interface SubtitleState {
  filename: string;
  subtitles: SubtitleItem[];
  enabled: boolean;
  settings: SubtitleSettings;
}
