/**
 * Simple floating popup for dictionary entries.
 * Used in the content script overlay. It creates a single DOM element that is reused.
 */
export class WordPopup {
  private popupEl: HTMLDivElement | null = null;

  constructor() {
    this.createElement();
  }

  private createElement(): void {
    const div = document.createElement('div');
    div.id = 'ja-word-popup';
    // Basic styling – premium look with glassmorphism
    div.style.setProperty('position', 'fixed', 'important');
    div.style.setProperty('background', 'rgba(30,30,30,0.85)', 'important');
    div.style.setProperty('color', '#fff', 'important');
    div.style.setProperty('padding', '12px 16px', 'important');
    div.style.setProperty('border-radius', '8px', 'important');
    div.style.setProperty('box-shadow', '0 4px 12px rgba(0,0,0,0.4)', 'important');
    div.style.setProperty('font-family', 'Inter, sans-serif', 'important');
    div.style.setProperty('font-size', '14px', 'important');
    div.style.setProperty('max-width', '300px', 'important');
    div.style.setProperty('z-index', '2147483647', 'important');
    div.style.setProperty('pointer-events', 'auto', 'important');
    div.style.setProperty('display', 'none', 'important');
    div.addEventListener('click', () => this.hide());
    document.body.appendChild(div);
    this.popupEl = div;
  }

  /** Show the popup at (x, y) screen coordinates. */
  public show(entry: { expression: string; reading?: string; meanings: string[] }, x: number, y: number): void {
    if (!this.popupEl) return;
    const { expression, reading, meanings } = entry;
    const html = `
      <strong>${expression}</strong>${reading ? ` (${reading})` : ''}<br/>
      ${meanings.map(m => `<div>· ${m}</div>`).join('')}
    `;
    this.popupEl.innerHTML = html;
    this.popupEl.style.left = `${x}px`;
    this.popupEl.style.top = `${y}px`;
    this.popupEl.style.transform = 'translate(-50%, -120%)'; // slightly above the word
    this.popupEl.style.display = 'block';
  }

  public hide(): void {
    if (this.popupEl) {
      this.popupEl.style.display = 'none';
    }
  }
}
