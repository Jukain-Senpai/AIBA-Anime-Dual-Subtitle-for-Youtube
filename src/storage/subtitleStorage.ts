import { SubtitleState } from '../types/subtitle';

const STORAGE_KEY = 'ja_dual_subtitle_state';

const DEFAULT_STATE: SubtitleState = {
  filename: '',
  subtitles: [],
  enabled: true,
  settings: {
    position: 'bottom',
    fontSize: 26,
    fontFamily: '"Hiragino Sans", "Meiryo", "Noto Sans CJK JP", "Noto Sans JP", sans-serif',
    textColor: '#ffffff',
    backgroundColor: '#000000',
    backgroundOpacity: 0.8,
    textOutline: true,
    outlineSize: 2,
    lineSpacing: 1.4,
    offset: 0,
    showFurigana: true,
  }
};

/**
 * Retrieves current SubtitleState from chrome.storage.local
 */
export async function getSubtitleState(): Promise<SubtitleState> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve(DEFAULT_STATE);
      return;
    }

    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (result && result[STORAGE_KEY]) {
        // Deep merge settings to ensure new defaults are applied if user has old storage format
        const loadedState = result[STORAGE_KEY];
        resolve({
          ...DEFAULT_STATE,
          ...loadedState,
          settings: {
            ...DEFAULT_STATE.settings,
            ...(loadedState.settings || {})
          }
        });
      } else {
        resolve(DEFAULT_STATE);
      }
    });
  });
}

/**
 * Saves partial or full SubtitleState updates to chrome.storage.local
 */
export async function saveSubtitleState(update: Partial<SubtitleState>): Promise<SubtitleState> {
  const currentState = await getSubtitleState();
  const newState: SubtitleState = { ...currentState, ...update };

  // Note: if update contains partial settings, caller should manually merge them before calling saveSubtitleState,
  // or we can handle it here, but spreading update is enough if caller provides full settings object.

  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve(newState);
      return;
    }

    chrome.storage.local.set({ [STORAGE_KEY]: newState }, () => {
      resolve(newState);
    });
  });
}

/**
 * Clears current subtitles from storage
 */
export async function clearSubtitles(): Promise<SubtitleState> {
  return saveSubtitleState({
    filename: '',
    subtitles: [],
  });
}

/**
 * Listens for state changes in chrome.storage.local
 */
export function onSubtitleStateChange(callback: (state: SubtitleState) => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return () => {};
  }

  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      const newValue = changes[STORAGE_KEY].newValue || DEFAULT_STATE;
      callback({ ...DEFAULT_STATE, ...newValue });
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
