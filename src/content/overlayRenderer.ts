import { SubtitleSettings } from '../types/subtitle';
import { JapaneseToken } from '../japanese/types';
import { YouTubePlayerObserver } from './youtubePlayer';
import { DictionaryService, DictionaryEntry } from '../japanese/dictionary';
import { WordPopup } from './wordPopup';
import { hasKanji, katakanaToHiragana } from '../japanese/furigana';

/**
 * Japanese Subtitle Overlay Renderer
 * Creates and updates an aesthetic overlay over YouTube's HTML5 video container.
 */
export class OverlayRenderer {
  private overlayElement: HTMLDivElement | null = null;
  private currentContainer: HTMLElement | null = null;
  private renderedText: string | null = null;
  private renderedSettingsHash: string | null = null;
  // Dependencies
  private playerObserver: YouTubePlayerObserver | null = null;
  private dictionaryService: DictionaryService | null = null;
  private wordPopup: WordPopup | null = null;

  constructor() {}

  /**
   * Set external services required for interaction.
   */
  public setDependencies(observer: YouTubePlayerObserver, dictService: DictionaryService): void {
    this.playerObserver = observer;
    this.dictionaryService = dictService;
    this.wordPopup = new WordPopup();
  }

  public mount(container: HTMLElement): void {
    if (!container) return;

    if (this.currentContainer !== container) {
      console.log(`[Japanese Dual Subtitle] Mounting overlay to container:`, container.tagName, container.className, container.id);
      this.currentContainer = container;

      if (this.overlayElement && this.overlayElement.parentElement) {
        this.overlayElement.parentElement.removeChild(this.overlayElement);
      }

      this.overlayElement = this.createOverlayElement();
      container.appendChild(this.overlayElement);
      // Reset cache so it forcefully re-renders
      this.renderedText = null;
      this.renderedSettingsHash = null;
    } else if (!this.overlayElement || !container.contains(this.overlayElement)) {
      console.log(`[Japanese Dual Subtitle] Re-mounting overlay to container:`, container.tagName, container.className, container.id);
      this.overlayElement = this.createOverlayElement();
      container.appendChild(this.overlayElement);
      this.renderedText = null;
      this.renderedSettingsHash = null;
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
        this.overlayElement.style.setProperty('display', 'none', 'important');
        this.renderedText = null;
      }
      return;
    }

    const settingsHash = JSON.stringify(settings);
    const textChanged = true; // tokens always re-render for simplicity
    const settingsChanged = this.renderedSettingsHash !== settingsHash;

    if (!settingsChanged && !textChanged) {
      return;
    }

    const isPunctuation = (surface: string, pos?: string) => {
      if (pos === '記号') return true;
      return /^[、。！？「」『』（）［］【】…—\s.,!?:;'"\-_=+\/\\|~`@#$%^&*()]+$/.test(surface);
    };

    // Build HTML with spans (skip interactive wrapping for punctuation)
    const html = tokens.map((t, i) => {
      const safeSurface = t.surface.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      if (isPunctuation(t.surface, t.partOfSpeech)) {
        return `<span class="ja-punct">${safeSurface}</span>`;
      }
      
      const isFuriganaEnabled = settings.showFurigana;
      const shouldShowFurigana = isFuriganaEnabled && hasKanji(t.surface) && t.reading && t.reading.trim() !== '';
      
      if (shouldShowFurigana) {
        const hiraganaReading = katakanaToHiragana(t.reading);
        return `<ruby class="ja-token" data-base="${t.baseForm}" data-reading="${t.reading}" data-surface="${t.surface}" data-index="${i}">${safeSurface}<rt>${hiraganaReading}</rt></ruby>`;
      }
      
      return `<span class="ja-token" data-base="${t.baseForm}" data-reading="${t.reading}" data-surface="${t.surface}" data-index="${i}">${safeSurface}</span>`;
    }).join('');
    this.overlayElement.innerHTML = html;
    this.renderedText = html;

    if (settingsChanged) {
      this.applySettings(settings);
      this.renderedSettingsHash = settingsHash;
    }

    // Attach click handler if not already
    this.overlayElement.removeEventListener('click', this.handleTokenClick);
    this.overlayElement.addEventListener('click', this.handleTokenClick);

    this.overlayElement.style.setProperty('display', 'block', 'important');
  }

  private handleTokenClick = async (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('.ja-token') as HTMLElement;
    if (!target) return;
    const base = target.getAttribute('data-base') || '';
    const reading = target.getAttribute('data-reading') || '';
    const surface = target.getAttribute('data-surface') || target.innerText.split('\n')[0] || base;
    if (!base.trim()) return;

    if (this.playerObserver) {
      this.playerObserver.pause();
    }
    
    if (this.dictionaryService && this.wordPopup) {
      const rect = target.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top;

      if (!this.dictionaryService.isLoaded()) {
        // Show loading state immediately
        this.wordPopup.show(null, surface, x, y, true);
        await this.dictionaryService.ensureLoaded();
      }

      const entry = this.dictionaryService.lookup(base) || (reading ? this.dictionaryService.lookup(reading) : null);
      
      this.wordPopup.show(
        entry
          ? { ...entry, reading: entry.reading || reading || undefined }
          : null,
        surface,
        x,
        y,
        false
      );
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
    if (this.overlayElement && this.overlayElement.parentElement) {
      this.overlayElement.parentElement.removeChild(this.overlayElement);
    }
    this.overlayElement = null;
    this.currentContainer = null;
    this.renderedText = null;
    this.renderedSettingsHash = null;
  }
}
