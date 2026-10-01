import type { DictionaryEntry } from '../japanese/types';
import type { JLPTLevel } from '../japanese/jlpt';
import { JLPT_COLORS } from '../japanese/jlptColors.ts';

/**
 * Simple floating popup for dictionary entries.
 * Used in the content script overlay. It creates a single DOM element that is reused.
 */
export class WordPopup {
  private popupEl: HTMLDivElement | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private escapeKeyHandler: ((e: KeyboardEvent) => void) | null = null;

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
      entry.meanings.slice(0, 6).forEach((meaning, index) => {
        const row = this.element('div', 'margin-bottom:4px');
        row.appendChild(this.element('span', 'color:#888;font-size:12px;margin-right:4px', `${index + 1}.`));
        row.appendChild(document.createTextNode(meaning));
        content.appendChild(row);
      });
      if (entry.meanings.length > 6) {
        content.appendChild(this.element('div', 'color:#666;font-size:12px;margin-top:4px', `+ ${entry.meanings.length - 6} more`));
      }
    }

    this.popupEl.replaceChildren(header, content);

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

    this.popupEl.style.left = `${finalX}px`;
    this.popupEl.style.top = `${finalY}px`;
  }

  public hide(): void {
    if (this.popupEl) {
      this.popupEl.style.display = 'none';
    }
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
