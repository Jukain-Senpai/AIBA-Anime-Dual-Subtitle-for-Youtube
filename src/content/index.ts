import { YouTubePlayerObserver } from './youtubePlayer';
import { OverlayRenderer } from './overlayRenderer';
import { findActiveSubtitle } from './subtitleEngine';
import { getSubtitleState, onSubtitleStateChange } from '../storage/subtitleStorage';
import { SubtitleState, SubtitleSettings } from '../types/subtitle';

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
};

let currentState: SubtitleState = {
  filename: '',
  subtitles: [],
  enabled: true,
  settings: defaultSettings,
};

const playerObserver = new YouTubePlayerObserver();
const overlayRenderer = new OverlayRenderer();

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

function updateOverlay(): void {
  const container = playerObserver.getVideoContainer();
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

  // Too spammy if left in production, but good for debugging initially
  // if (activeSub) {
  //   console.log(`[Japanese Dual Subtitle] Match at ${currentTime.toFixed(1)}s: "${activeSub.text}"`);
  // }

  overlayRenderer.render(
    activeSub ? activeSub.text : null,
    currentState.enabled && currentState.subtitles.length > 0,
    currentState.settings
  );
}

