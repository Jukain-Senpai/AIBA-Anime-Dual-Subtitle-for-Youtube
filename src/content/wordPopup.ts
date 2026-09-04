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
        if (!this.popupEl.contains(target) && !target.classList.contains('ja-token')) {
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

  /** Show the popup at (x, y) screen coordinates. */
  public show(entry: { expression: string; reading?: string; meanings: string[] }, x: number, y: number): void {
    if (!this.popupEl) return;
    const { expression, reading, meanings } = entry;
    const html = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div style="font-size: 16px;">
          <strong>${expression}</strong>${reading ? ` <span style="color: #bbb;">(${reading})</span>` : ''}
        </div>
        <div class="ja-word-popup-close" style="cursor: pointer; padding: 0 4px; font-size: 16px; line-height: 1; color: #999;">&times;</div>
      </div>
      <div style="font-size: 14px; line-height: 1.4;">
        ${meanings.map(m => `<div><span style="color: #888;">·</span> ${m}</div>`).join('')}
      </div>
    `;
    this.popupEl.innerHTML = html;

    const closeBtn = this.popupEl.querySelector('.ja-word-popup-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

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
