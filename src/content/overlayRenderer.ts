import type { SubtitleSettings } from '../types/subtitle';
import type { JapaneseToken } from '../japanese/types';
import type { YouTubePlayerObserver } from './youtubePlayer';
import type { DictionaryService } from '../japanese/dictionary';
import { WordPopup } from './wordPopup.ts';
import { hasKanji, katakanaToHiragana } from '../japanese/furigana.ts';
import { JLPT_COLORS } from '../japanese/jlptColors.ts';
import type { JLPTService, JLPTLevel } from '../japanese/jlpt';
import type { SavedVocabulary, VocabularyDraft } from '../types/vocabulary';
import { createVocabularyIdentity } from '../storage/vocabularyIdentity.ts';
import type { VocabularyStorageClient } from '../storage/vocabularyStorage';
import type { WordPopupBookmarkState } from './wordPopup.ts';

function isPunctuation(surface: string, partOfSpeech: string): boolean {
  return partOfSpeech === '記号' || /^[\p{P}\p{S}\s]+$/u.test(surface);
}

/**
 * Japanese Subtitle Overlay Renderer
 * Creates and updates an aesthetic overlay over YouTube's HTML5 video container.
 */
export class OverlayRenderer {
  private overlayElement: HTMLDivElement | null = null;
  private currentContainer: HTMLElement | null = null;
  private renderedText: string | null = null;
  private renderedSettingsHash: string | null = null;
  private renderedTokens: JapaneseToken[] | null = null;
  // Dependencies
  private playerObserver: YouTubePlayerObserver | null = null;
  private dictionaryService: DictionaryService | null = null;
  private jlptService: JLPTService | null = null;
  private vocabularyStorage: VocabularyStorageClient | null = null;
  private wordPopup: WordPopup | null = null;
  private popupRequestId = 0;
  private unsubscribeVocabulary: (() => void) | null = null;
  private refreshActiveBookmark: ((entries: SavedVocabulary[], error: string | null) => void) | null = null;

  constructor() {}

  /**
   * Set external services required for interaction.
   */
  public setDependencies(
    observer: YouTubePlayerObserver,
    dictService: DictionaryService,
    jlptService: JLPTService,
    vocabularyStorage: VocabularyStorageClient,
  ): void {
    this.playerObserver = observer;
    this.dictionaryService = dictService;
    this.jlptService = jlptService;
    this.vocabularyStorage = vocabularyStorage;
    this.wordPopup = new WordPopup();
    this.unsubscribeVocabulary?.();
    this.unsubscribeVocabulary = vocabularyStorage.subscribe(({ entries, error }) => {
      this.refreshActiveBookmark?.(entries, error?.message ?? null);
    });
  }

  public mount(container: HTMLElement): void {
    if (!container) return;

    if (this.currentContainer !== container) {
      console.log(`[Japanese Dual Subtitle] Mounting overlay to container:`, container.tagName, container.className, container.id);
      this.popupRequestId += 1;
      this.wordPopup?.hide();
      this.currentContainer = container;

      if (this.overlayElement && this.overlayElement.parentElement) {
        this.overlayElement.parentElement.removeChild(this.overlayElement);
      }

      this.overlayElement = this.createOverlayElement();
      container.appendChild(this.overlayElement);
      // Reset cache so it forcefully re-renders
      this.renderedText = null;
      this.renderedSettingsHash = null;
      this.renderedTokens = null;
    } else if (!this.overlayElement || !container.contains(this.overlayElement)) {
      console.log(`[Japanese Dual Subtitle] Re-mounting overlay to container:`, container.tagName, container.className, container.id);
      this.overlayElement = this.createOverlayElement();
      container.appendChild(this.overlayElement);
      this.renderedText = null;
      this.renderedSettingsHash = null;
      this.renderedTokens = null;
    }
  }

  private createOverlayElement(): HTMLDivElement {
    const div = document.createElement('div');
    div.id = 'ja-dual-subtitle-overlay';
    div.className = 'ja-dual-subtitle-overlay-active';

    div.style.setProperty('position', 'absolute', 'important');
    div.style.setProperty('z-index', '2147483647', 'important');
    div.style.setProperty('pointer-events', 'none', 'important');
    div.style.setProperty('text-align', 'center', 'important');
    div.style.setProperty('max-width', '85%', 'important');
    div.style.setProperty('padding', '8px 16px', 'important');
    div.style.setProperty('border-radius', '8px', 'important');
    div.style.setProperty('display', 'none', 'important');
    div.style.setProperty('white-space', 'pre-wrap', 'important');
    
    // Default positioning before settings are applied
    div.style.setProperty('left', '50%', 'important');
    div.style.setProperty('transform', 'translateX(-50%)', 'important');
    div.style.setProperty('bottom', '10%', 'important');

    // Inject styles for tokens if not already present
    if (!document.getElementById('ja-dual-subtitle-style')) {
      const style = document.createElement('style');
      style.id = 'ja-dual-subtitle-style';
      style.textContent = `
        .ja-token {
          pointer-events: auto;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .ja-token:hover {
          background: rgba(255, 255, 100, 0.3);
          border-radius: 3px;
        }
        .ja-token[data-jlpt] .ja-token-surface {
          box-shadow: inset 0 -2px 0 var(--ja-jlpt-color);
        }
        ruby.ja-token {
          ruby-position: over;
        }
        ruby.ja-token rt {
          font-size: 0.5em;
          opacity: 0.85;
          user-select: none;
          pointer-events: none;
        }
        ruby.ja-token:hover rt {
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    }

    div.addEventListener('click', this.handleTokenClick);

    return div;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  public render(text: string | null, enabled: boolean, settings: SubtitleSettings): void {
    if (!this.overlayElement) return;

    if (!enabled || !text) {
      if (this.renderedText !== null) {
        this.overlayElement.style.setProperty('display', 'none', 'important');
        this.renderedText = null;
      }
      return;
    }

    const settingsHash = JSON.stringify(settings);
    const textChanged = this.renderedText !== text;
    const settingsChanged = this.renderedSettingsHash !== settingsHash;

    if (!textChanged && !settingsChanged) {
      return; // No DOM update needed
    }

    if (textChanged) {
      this.overlayElement.innerText = text;
      this.renderedText = text;
      this.renderedTokens = null;
    }

    if (settingsChanged) {
      this.applySettings(settings);
      this.renderedSettingsHash = settingsHash;
    }

    // Ensure it's visible
    this.overlayElement.style.setProperty('display', 'block', 'important');
  }

  /**
   * Render tokenized subtitle with interactive spans.
   */
  public renderTokens(tokens: JapaneseToken[] | null, enabled: boolean, settings: SubtitleSettings): void {
    if (!this.overlayElement) return;

    if (!enabled || !tokens) {
      if (this.renderedText !== null) {
        this.popupRequestId += 1;
        this.wordPopup?.hide();
        this.overlayElement.style.setProperty('display', 'none', 'important');
        this.renderedText = null;
        this.renderedTokens = null;
      }
      return;
    }

    const settingsHash = JSON.stringify(settings);
    const tokensChanged = this.renderedTokens !== tokens;
    const settingsChanged = this.renderedSettingsHash !== settingsHash;

    if (!settingsChanged && !tokensChanged) {
      return;
    }

    const nextText = tokens.map((token) => token.surface).join('');
    if (this.renderedText !== null && this.renderedText !== nextText) {
      this.popupRequestId += 1;
      this.wordPopup?.hide();
    }

    const fragment = document.createDocumentFragment();
    tokens.forEach((t, i) => {
      if (isPunctuation(t.surface, t.partOfSpeech)) {
        const punctuation = document.createElement('span');
        punctuation.className = 'ja-punct';
        punctuation.textContent = t.surface;
        fragment.appendChild(punctuation);
        return;
      }

      const shouldShowFurigana = settings.showFurigana && hasKanji(t.surface) && t.reading.trim() !== '';
      const tokenElement = document.createElement(shouldShowFurigana ? 'ruby' : 'span');
      tokenElement.className = 'ja-token';
      tokenElement.dataset.base = t.baseForm;
      tokenElement.dataset.reading = t.reading;
      tokenElement.dataset.surface = t.surface;
      tokenElement.dataset.index = String(i);

      const surface = document.createElement('span');
      surface.className = 'ja-token-surface';
      surface.textContent = t.surface;
      tokenElement.appendChild(surface);

      if (settings.showJLPTColors && t.jlptLevel && JLPT_COLORS[t.jlptLevel]) {
        tokenElement.dataset.jlpt = t.jlptLevel;
        tokenElement.style.setProperty('--ja-jlpt-color', JLPT_COLORS[t.jlptLevel]);
      }

      if (shouldShowFurigana) {
        const reading = document.createElement('rt');
        reading.textContent = katakanaToHiragana(t.reading);
        tokenElement.appendChild(reading);
      }

      fragment.appendChild(tokenElement);
    });
    this.overlayElement.replaceChildren(fragment);
    this.renderedTokens = tokens;
    this.renderedText = nextText;

    if (settingsChanged) {
      this.applySettings(settings);
      this.renderedSettingsHash = settingsHash;
    }

    this.overlayElement.style.setProperty('display', 'block', 'important');
  }

  private handleTokenClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('.ja-token') as HTMLElement;
    if (!target) return;
    const base = target.getAttribute('data-base') || '';
    const reading = target.getAttribute('data-reading') || '';
    const surface = target.getAttribute('data-surface') || target.innerText.split('\n')[0] || base;
    if (!base.trim()) return;

    if (this.playerObserver) {
      this.playerObserver.pause();
    }
    
    if (this.playerObserver && this.dictionaryService && this.jlptService && this.wordPopup && this.vocabularyStorage) {
      const requestId = ++this.popupRequestId;
      const dictionaryService = this.dictionaryService;
      const jlptService = this.jlptService;
      const wordPopup = this.wordPopup;
      const vocabularyStorage = this.vocabularyStorage;
      const playerObserver = this.playerObserver;
      const clickedText = this.renderedText;
      const source = playerObserver.getVocabularySource(clickedText ?? undefined);
      const tokenIndex = Number(target.dataset.index);
      const rect = target.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top;
      let dictionaryReady = dictionaryService.isLoaded();
      let entry = dictionaryReady
        ? dictionaryService.lookup(base) || (reading ? dictionaryService.lookup(reading) : null)
        : null;
      let level: JLPTLevel = jlptService.isLoaded()
        ? jlptService.lookup(base, reading, surface)
        : null;
      let isSaved = false;
      let bookmarkPending = true;
      let bookmarkError: string | null = null;
      let bookmarkOperationId = 0;

      const isCurrent = () =>
        requestId === this.popupRequestId &&
        this.renderedText === clickedText &&
        this.renderedTokens?.[tokenIndex]?.baseForm === base &&
        this.renderedTokens?.[tokenIndex]?.reading === reading &&
        this.renderedTokens?.[tokenIndex]?.surface === surface &&
        !!this.overlayElement && this.overlayElement.style.display !== 'none' &&
        wordPopup.isVisible();

      const getBookmarkIdentity = () => createVocabularyIdentity({
        expression: entry?.expression || base,
        reading: entry?.reading || reading,
        surface,
      });

      const createDraft = (): VocabularyDraft => ({
        expression: entry?.expression || base,
        reading: entry?.reading || reading,
        baseForm: base,
        surface,
        meanings: entry?.meanings ? [...entry.meanings] : [],
        partOfSpeech: entry?.partOfSpeech ? [...entry.partOfSpeech] : [],
        jlptLevel: level,
        source: source ? { ...source } : undefined,
      });

      const toggleBookmark = () => {
        if (bookmarkPending || !isCurrent()) return;
        const operationId = ++bookmarkOperationId;
        const identity = getBookmarkIdentity();
        const draft = createDraft();
        const removing = isSaved;
        bookmarkPending = true;
        bookmarkError = null;
        showCurrent();

        const operation = removing
          ? vocabularyStorage.remove(identity.id).then(() => null)
          : vocabularyStorage.save(draft);

        void operation.then(() => {
          if (!isCurrent() || operationId !== bookmarkOperationId) return;
          isSaved = !removing;
          bookmarkPending = false;
          showCurrent();
        }).catch((error: unknown) => {
          if (!isCurrent() || operationId !== bookmarkOperationId) return;
          bookmarkPending = false;
          bookmarkError = error instanceof Error ? error.message : 'Unable to update saved vocabulary.';
          showCurrent();
        });
      };

      const showCurrent = () => {
        const bookmark: WordPopupBookmarkState = {
          isSaved,
          pending: bookmarkPending,
          error: bookmarkError,
          onToggle: toggleBookmark,
        };
        wordPopup.show(
          entry ? { ...entry, reading: entry.reading || reading || '' } : null,
          surface,
          x,
          y,
          !dictionaryReady,
          level,
          bookmark,
        );
      };

      const refreshSavedStatus = () => {
        if (!dictionaryReady || !isCurrent()) return;
        const operationId = ++bookmarkOperationId;
        const identity = getBookmarkIdentity();
        bookmarkPending = true;
        bookmarkError = null;
        showCurrent();
        void vocabularyStorage.isSaved(identity.expression, identity.reading, identity.surface).then((saved) => {
          if (!isCurrent() || operationId !== bookmarkOperationId) return;
          isSaved = saved;
          bookmarkPending = false;
          showCurrent();
        }).catch((error: unknown) => {
          if (!isCurrent() || operationId !== bookmarkOperationId) return;
          bookmarkPending = false;
          bookmarkError = error instanceof Error ? error.message : 'Unable to check saved vocabulary.';
          showCurrent();
        });
      };

      this.refreshActiveBookmark = (entries, error) => {
        if (!isCurrent()) return;
        if (error) {
          bookmarkError = error;
        } else {
          isSaved = entries.some((savedEntry) => savedEntry.id === getBookmarkIdentity().id);
          bookmarkError = null;
        }
        showCurrent();
      };

      // Show the current dictionary state immediately; each independent load can
      // update it only while this clicked token still owns the popup.
      showCurrent();
      if (dictionaryReady) refreshSavedStatus();

      if (!dictionaryReady) {
        void dictionaryService.ensureLoaded().then(() => {
          if (!isCurrent()) return;
          dictionaryReady = true;
          entry = dictionaryService.lookup(base) || (reading ? dictionaryService.lookup(reading) : null);
          showCurrent();
          refreshSavedStatus();
        });
      }

      if (!jlptService.isLoaded()) {
        void jlptService.ensureLoaded().then(() => {
          if (!isCurrent()) return;
          level = jlptService.lookup(base, reading, surface);
          showCurrent();
        });
      }
    }
  };

  private applySettings(settings: SubtitleSettings): void {
    if (!this.overlayElement) return;
    const style = this.overlayElement.style;

    // Font and Colors
    style.setProperty('font-size', `${settings.fontSize}px`, 'important');
    style.setProperty('font-family', settings.fontFamily, 'important');
    style.setProperty('color', settings.textColor, 'important');
    style.setProperty('line-height', `${settings.lineSpacing}`, 'important');

    const bgColor = this.hexToRgba(settings.backgroundColor, settings.backgroundOpacity);
    style.setProperty('background-color', bgColor, 'important');

    // Text Outline / Stroke
    if (settings.textOutline && settings.outlineSize > 0) {
      style.setProperty('-webkit-text-stroke', `${settings.outlineSize}px black`, 'important');
      // Adding a slight drop shadow looks better with stroke
      style.setProperty('text-shadow', '0 4px 10px rgba(0,0,0,0.8)', 'important');
    } else {
      style.setProperty('-webkit-text-stroke', '0px transparent', 'important');
      style.setProperty('text-shadow', 'none', 'important');
    }

    // Position
    let top = 'auto';
    let bottom = 'auto';
    let transform = 'translateX(-50%)';

    switch (settings.position) {
      case 'top':
        top = '10%';
        break;
      case 'center':
        top = '50%';
        transform = 'translate(-50%, -50%)';
        break;
      case 'bottom':
        bottom = '10%';
        break;
      case 'above_yt':
        bottom = '20%';
        break;
      case 'below_yt':
        bottom = '2%';
        break;
    }

    style.setProperty('top', top, 'important');
    style.setProperty('bottom', bottom, 'important');
    style.setProperty('transform', transform, 'important');
  }

  public destroy(): void {
    this.popupRequestId += 1;
    this.refreshActiveBookmark = null;
    this.unsubscribeVocabulary?.();
    this.unsubscribeVocabulary = null;
    this.wordPopup?.destroy();
    this.wordPopup = null;
    if (this.overlayElement && this.overlayElement.parentElement) {
      this.overlayElement.parentElement.removeChild(this.overlayElement);
    }
    this.overlayElement = null;
    this.currentContainer = null;
    this.renderedText = null;
    this.renderedSettingsHash = null;
    this.renderedTokens = null;
  }
}
