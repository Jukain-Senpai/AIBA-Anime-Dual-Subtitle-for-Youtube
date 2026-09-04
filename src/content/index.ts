import { YouTubePlayerObserver } from './youtubePlayer';
import { OverlayRenderer } from './overlayRenderer';
import { findActiveSubtitle } from './subtitleEngine';
import { getSubtitleState, onSubtitleStateChange } from '../storage/subtitleStorage';
import { SubtitleState, SubtitleSettings } from '../types/subtitle';
import { TokenizerService } from '../japanese/tokenizer';
import { DictionaryService } from '../japanese/dictionary';
import { JapaneseToken } from '../japanese/types';

console.log('[Japanese Dual Subtitle] Content script loaded on YouTube.');

const defaultSettings: SubtitleSettings = {
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
};

let currentState: SubtitleState = {
  filename: '',
  subtitles: [],
  enabled: true,
  settings: defaultSettings,
};

const playerObserver = new YouTubePlayerObserver();
const overlayRenderer = new OverlayRenderer();
const tokenizerService = new TokenizerService();
const dictionaryService = new DictionaryService();

// Set dependencies for interactive overlay
overlayRenderer.setDependencies(playerObserver, dictionaryService);

// Pre-init tokenizer in the background
tokenizerService.init().catch(e => console.warn('[Japanese Dual Subtitle] Tokenizer pre-init failed', e));

// State for rendering and caching
const tokenCache = new Map<string, JapaneseToken[]>();
let currentRenderingText: string | null = null;

// Load initial subtitle state from chrome.storage
getSubtitleState().then((state) => {
  currentState = state;
  console.log('[Japanese Dual Subtitle] Loaded initial storage state:', {
    filename: state.filename,
    subtitleCount: state.subtitles.length,
    offset: state.settings.offset,
    enabled: state.enabled,
  });
  updateOverlay();
});

// React to storage changes from Popup UI instantly
onSubtitleStateChange((newState) => {
  currentState = newState;
  console.log('[Japanese Dual Subtitle] Storage updated:', {
    filename: newState.filename,
    subtitleCount: newState.subtitles.length,
    offset: newState.settings.offset,
    enabled: newState.enabled,
  });
  updateOverlay();
});

// Fallback message listener for direct Popup notifications
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'SUBTITLE_STATE_UPDATE' && message.payload) {
      currentState = message.payload;
      console.log('[Japanese Dual Subtitle] Direct message received:', {
        filename: currentState.filename,
        subtitleCount: currentState.subtitles.length,
        offset: currentState.settings.offset,
        enabled: currentState.enabled,
      });
      updateOverlay();
    }
  });
}

// Listen for playback time updates from YouTube HTML5 video element
playerObserver.onTimeUpdate((currentTime) => {
  updateOverlay();
});

function createFallbackTokens(text: string): JapaneseToken[] {
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    try {
      const segmenter = new (Intl as any).Segmenter('ja', { granularity: 'word' });
      const segments = Array.from(segmenter.segment(text)) as Array<{ segment: string; index: number }>;
      return segments.map((seg) => ({
        surface: seg.segment,
        reading: '',
        baseForm: seg.segment,
        partOfSpeech: 'Unknown',
        startIndex: seg.index,
        endIndex: seg.index + seg.segment.length,
      }));
    } catch (e) {
      console.warn('[Japanese Dual Subtitle] Intl.Segmenter fallback failed:', e);
    }
  }
  return text.split('').map((char, index) => ({
    surface: char,
    reading: '',
    baseForm: char,
    partOfSpeech: 'Unknown',
    startIndex: index,
    endIndex: index + 1,
  }));
}

function updateOverlay(): void {
  const container = playerObserver.getContainer();
  if (container) {
    overlayRenderer.mount(container);
  } else {
    // Suppress repeated warnings
    return;
  }

  const currentTime = playerObserver.getCurrentTime();
  const activeSub = findActiveSubtitle(
    currentState.subtitles,
    currentTime,
    currentState.settings.offset
  );

  const enabled = currentState.enabled && currentState.subtitles.length > 0;
  const text = activeSub ? activeSub.text : null;

  if (!enabled || !text) {
    currentRenderingText = null;
    overlayRenderer.renderTokens(null, enabled, currentState.settings);
    return;
  }

  if (currentRenderingText === text) {
    // Already processing or rendering this text, or tokenizer is working on it.
    // If settings changed, we should ideally re-render. Let's pass the cache if available.
    if (tokenCache.has(text)) {
      overlayRenderer.renderTokens(tokenCache.get(text)!, enabled, currentState.settings);
    }
    return;
  }

  currentRenderingText = text;

  if (tokenCache.has(text)) {
    overlayRenderer.renderTokens(tokenCache.get(text)!, enabled, currentState.settings);
  } else {
    // Asynchronously tokenize the new subtitle text
    tokenizerService.tokenize(text).then((tokens) => {
      tokenCache.set(text, tokens);
      // Ensure the active text hasn't changed (e.g. from rapid seeking) while we were tokenizing
      if (currentRenderingText === text) {
        overlayRenderer.renderTokens(tokens, enabled, currentState.settings);
      }
    }).catch((e) => {
      console.warn('[Japanese Dual Subtitle] Tokenization failed, using segmenter fallback:', e);
      if (currentRenderingText === text) {
        const fallbackTokens = createFallbackTokens(text);
        tokenCache.set(text, fallbackTokens);
        overlayRenderer.renderTokens(fallbackTokens, enabled, currentState.settings);
      }
    });
  }
}
