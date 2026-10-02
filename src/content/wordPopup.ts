import type { DictionaryEntry } from '../japanese/types';
import type { JLPTLevel } from '../japanese/jlpt';
import { JLPT_COLORS } from '../japanese/jlptColors.ts';

export interface WordPopupBookmarkState {
  isSaved: boolean;
  pending: boolean;
  error: string | null;
  onToggle: () => void;
}

/**
 * Simple floating popup for dictionary entries.
 * Used in the content script overlay. It creates a single DOM element that is reused.
 */
export class WordPopup {
  private popupEl: HTMLDivElement | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private escapeKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private expandedMeaningsKey: string | null = null;

  constructor() {
    this.createElement();
  }

  private createElement(): void {
    if (this.popupEl) return;
    const div = document.createElement('div');
    div.id = 'ja-word-popup';
    // Basic styling – premium look with glassmorphism
    div.style.setProperty('position', 'fixed', 'important');
    div.style.setProperty('background', 'rgba(30,30,30,0.85)', 'important');
    div.style.setProperty('color', '#fff', 'important');
    div.style.setProperty('padding', '16px', 'important');
    div.style.setProperty('border-radius', '8px', 'important');
    div.style.setProperty('box-shadow', '0 4px 12px rgba(0,0,0,0.4)', 'important');
    div.style.setProperty('font-family', 'Inter, sans-serif', 'important');
    div.style.setProperty('font-size', '14px', 'important');
    div.style.setProperty('max-width', '300px', 'important');
    div.style.setProperty('max-height', 'calc(100vh - 20px)', 'important');
    div.style.setProperty('overflow-y', 'auto', 'important');
    div.style.setProperty('z-index', '2147483647', 'important');
    div.style.setProperty('pointer-events', 'auto', 'important');
    div.style.setProperty('display', 'none', 'important');
    
    // Prevent clicks inside popup from closing it
    div.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.body.appendChild(div);
    this.popupEl = div;

    this.outsideClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Hide popup if clicked outside of popup AND outside of token
      if (this.popupEl && this.popupEl.style.display === 'block') {
        if (!this.popupEl.contains(target) && !target.closest('.ja-token')) {
          this.hide();
        }
      }
    };
    document.addEventListener('click', this.outsideClickHandler, { capture: true });

    this.escapeKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.popupEl && this.popupEl.style.display === 'block') {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.escapeKeyHandler);
  }

  private element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    styles: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    element.style.cssText = styles;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  public isVisible(): boolean {
    return this.popupEl?.style.display === 'block';
  }

  public show(
    entry: DictionaryEntry | null,
    surface: string,
    x: number,
    y: number,
    isLoading: boolean = false,
    jlptLevel: JLPTLevel = null,
    bookmark?: WordPopupBookmarkState,
  ): void {
    if (!this.popupEl) return;

    const header = this.element('div', 'display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px');
    const heading = this.element('div', 'min-width:0');
    const title = this.element('div', `display:flex;align-items:center;flex-wrap:wrap;gap:7px;font-size:${entry && !isLoading ? 18 : 16}px;font-weight:600;line-height:1.2`);
    const displayedWord = entry && !isLoading && surface === entry.expression ? entry.expression : surface;
    title.appendChild(this.element('strong', '', displayedWord));

    if (entry && !isLoading && surface !== entry.expression && surface !== entry.reading) {
      title.appendChild(this.element('span', 'font-size:12px;font-weight:normal;color:#aaa', `(Base: ${entry.expression})`));
    }
    if (jlptLevel) {
      const badge = this.element('span', 'font-size:11px;font-weight:700;line-height:1;padding:4px 6px;border-radius:4px;color:#101828', jlptLevel);
      badge.className = 'ja-word-popup-jlpt';
      badge.style.backgroundColor = JLPT_COLORS[jlptLevel];
      badge.title = 'Approximate JLPT vocabulary level';
      title.appendChild(badge);
    }
    heading.appendChild(title);

    if (entry?.reading && !isLoading) {
      heading.appendChild(this.element('div', 'font-size:13px;color:#bbb;margin-top:2px', entry.reading));
    }
    header.appendChild(heading);

    const closeBtn = this.element('button', 'cursor:pointer;padding:0 4px;font-size:18px;line-height:1;color:#999;background:none;border:0', '×');
    closeBtn.type = 'button';
    closeBtn.className = 'ja-word-popup-close';
    closeBtn.setAttribute('aria-label', 'Close word popup');
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    const content = this.element('div', 'font-size:14px;line-height:1.4');
    if (isLoading) {
      content.textContent = 'Dictionary loading...';
      content.style.color = '#aaa';
    } else if (!entry) {
      content.textContent = 'No dictionary entry found.';
      content.style.color = '#aaa';
    } else {
      if (entry.partOfSpeech?.length) {
        const pos = this.element('div', 'font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#9cdcfe;margin-bottom:6px', entry.partOfSpeech.join(', '));
        content.appendChild(pos);
      }
      const meaningsKey = `${entry.expression}\u0000${entry.reading}`;
      const meaningsList = this.element('div', '');
      meaningsList.className = 'ja-word-popup-meanings';
      const renderMeanings = () => {
        const expanded = this.expandedMeaningsKey === meaningsKey;
        const visibleMeanings = expanded ? entry.meanings : entry.meanings.slice(0, 6);
        const meaningChildren: HTMLElement[] = visibleMeanings.map((meaning, index) => {
          const row = this.element('div', 'margin-bottom:4px');
          row.appendChild(this.element('span', 'color:#888;font-size:12px;margin-right:4px', `${index + 1}.`));
          row.appendChild(document.createTextNode(meaning));
          return row;
        });
        if (entry.meanings.length > 6) {
          const toggle = this.element(
            'button',
            'display:block;margin-top:5px;padding:3px 0;border:0;background:none;color:#93c5fd;font:600 12px Inter,sans-serif;cursor:pointer',
            expanded ? 'Show fewer' : `+ ${entry.meanings.length - 6} more`,
          );
          toggle.type = 'button';
          toggle.className = 'ja-word-popup-meanings-toggle';
          toggle.setAttribute('aria-expanded', String(expanded));
          toggle.addEventListener('click', () => {
            this.expandedMeaningsKey = expanded ? null : meaningsKey;
            renderMeanings();
          });
          meaningChildren.push(toggle);
        }
        meaningsList.style.maxHeight = expanded ? '230px' : 'none';
        meaningsList.style.overflowY = expanded ? 'auto' : 'visible';
        meaningsList.style.paddingRight = expanded ? '5px' : '0';
        meaningsList.replaceChildren(...meaningChildren);
      };
      renderMeanings();
      content.appendChild(meaningsList);
    }

    const children: HTMLElement[] = [header, content];
    if (bookmark) {
      const bookmarkArea = this.element('div', 'border-top:1px solid rgba(255,255,255,0.12);margin-top:12px;padding-top:10px');
      const bookmarkButton = this.element(
        'button',
        'width:100%;display:flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:7px 10px;border:1px solid rgba(96,165,250,0.55);border-radius:6px;background:rgba(59,130,246,0.14);color:#dbeafe;font:600 13px Inter,sans-serif;cursor:pointer',
      );
      bookmarkButton.type = 'button';
      bookmarkButton.className = 'ja-word-popup-bookmark';
      bookmarkButton.disabled = bookmark.pending;
      bookmarkButton.setAttribute('aria-pressed', String(bookmark.isSaved));
      bookmarkButton.setAttribute(
        'aria-label',
        bookmark.pending ? 'Updating saved vocabulary' : bookmark.isSaved ? 'Remove saved vocabulary' : 'Save vocabulary',
      );
      bookmarkButton.style.opacity = bookmark.pending ? '0.65' : '1';
      bookmarkButton.style.cursor = bookmark.pending ? 'wait' : 'pointer';
      const icon = bookmark.pending ? '…' : bookmark.isSaved ? '★' : '☆';
      const label = bookmark.pending ? 'Updating…' : bookmark.isSaved ? 'Saved' : 'Save Word';
      bookmarkButton.append(
        this.element('span', 'font-size:17px;line-height:1', icon),
        this.element('span', '', label),
      );
      bookmarkButton.addEventListener('click', () => {
        if (!bookmark.pending) bookmark.onToggle();
      });
      bookmarkArea.appendChild(bookmarkButton);

      if (bookmark.error) {
        const error = this.element('div', 'margin-top:7px;color:#fca5a5;font-size:12px;line-height:1.35', bookmark.error);
        error.className = 'ja-word-popup-bookmark-error';
        error.setAttribute('role', 'status');
        bookmarkArea.appendChild(error);
      }
      children.push(bookmarkArea);
    }

    this.popupEl.replaceChildren(...children);

    // Reset styles for measurement
    this.popupEl.style.display = 'block';
    this.popupEl.style.left = '0px';
    this.popupEl.style.top = '0px';
    this.popupEl.style.transform = 'none';

    // Measure bounding client rect
    const rect = this.popupEl.getBoundingClientRect();
    
    // Calculate final position
    let finalX = x - rect.width / 2;
    let finalY = y - rect.height - 10; // 10px above the word

    // Clamp to viewport
    const padding = 10;
    if (finalX < padding) finalX = padding;
    if (finalX + rect.width > window.innerWidth - padding) finalX = window.innerWidth - rect.width - padding;
    
    // If it doesn't fit above, show below
    if (finalY < padding) {
      finalY = y + 30; // approx height of the word plus some space
    }
    if (finalY + rect.height > window.innerHeight - padding) {
      finalY = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    this.popupEl.style.left = `${finalX}px`;
    this.popupEl.style.top = `${finalY}px`;
  }

  public hide(): void {
    if (this.popupEl) {
      this.popupEl.style.display = 'none';
    }
    this.expandedMeaningsKey = null;
  }

  public destroy(): void {
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler, { capture: true });
    }
    if (this.escapeKeyHandler) {
      document.removeEventListener('keydown', this.escapeKeyHandler);
    }
    if (this.popupEl && this.popupEl.parentElement) {
      this.popupEl.parentElement.removeChild(this.popupEl);
    }
    this.popupEl = null;
  }
}
