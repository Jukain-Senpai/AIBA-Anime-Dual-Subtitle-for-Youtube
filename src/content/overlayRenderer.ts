import { SubtitleSettings } from '../types/subtitle';

/**
 * Japanese Subtitle Overlay Renderer
 * Creates and updates an aesthetic overlay over YouTube's HTML5 video container.
 */
export class OverlayRenderer {
  private overlayElement: HTMLDivElement | null = null;
  private currentContainer: HTMLElement | null = null;
  
  // Caching to prevent DOM thrashing
  private renderedText: string | null = null;
  private renderedSettingsHash: string | null = null;

  constructor() {}

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
