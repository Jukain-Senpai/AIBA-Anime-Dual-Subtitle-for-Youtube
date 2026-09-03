/**
 * YouTube HTML5 Video Element Observer
 * Decoupled from YouTube UI internals; relies strictly on HTML5 standard video element.
 */
export class YouTubePlayerObserver {
  private videoElement: HTMLVideoElement | null = null;
  private timeUpdateCallbacks: Set<(currentTime: number) => void> = new Set();
  private observerInterval: number | null = null;

  constructor() {
    this.initPlayerDetection();
  }

  /** Periodically checks for presence of YouTube video element to handle SPA navigation or dynamic DOM changes. */
  private initPlayerDetection(): void {
    this.detectVideoElement();
    this.observerInterval = window.setInterval(() => this.detectVideoElement(), 1000);
  }

  /** Attempts to locate the active <video> tag on YouTube page */
  private detectVideoElement(): HTMLVideoElement | null {
    const video = (document.querySelector('.html5-main-video') || document.querySelector('video')) as HTMLVideoElement | null;
    if (video && video !== this.videoElement) {
      if (this.videoElement) this.unbindVideoEvents(this.videoElement);
      this.videoElement = video;
      console.log('[Japanese Dual Subtitle] Target <video> element detected on YouTube page.', video);
      this.bindVideoEvents(this.videoElement);
      this.notifyCallbacks(video.currentTime);
    }
    return this.videoElement;
  }

  private handleTimeUpdate = (): void => {
    if (this.videoElement) this.notifyCallbacks(this.videoElement.currentTime);
  };

  private bindVideoEvents(video: HTMLVideoElement): void {
    video.addEventListener('timeupdate', this.handleTimeUpdate);
    video.addEventListener('seeking', this.handleTimeUpdate);
    video.addEventListener('seeked', this.handleTimeUpdate);
    video.addEventListener('play', this.handleTimeUpdate);
    video.addEventListener('pause', this.handleTimeUpdate);
  }

  private unbindVideoEvents(video: HTMLVideoElement): void {
    video.removeEventListener('timeupdate', this.handleTimeUpdate);
    video.removeEventListener('seeking', this.handleTimeUpdate);
    video.removeEventListener('seeked', this.handleTimeUpdate);
    video.removeEventListener('play', this.handleTimeUpdate);
    video.removeEventListener('pause', this.handleTimeUpdate);
  }

  private notifyCallbacks(currentTime: number): void {
    this.timeUpdateCallbacks.forEach(cb => cb(currentTime));
  }

  /** Registers a callback to receive current playback time updates */
  public onTimeUpdate(callback: (currentTime: number) => void): () => void {
    this.timeUpdateCallbacks.add(callback);
    if (this.videoElement) callback(this.videoElement.currentTime);
    return () => this.timeUpdateCallbacks.delete(callback);
  }

  /** Returns current video playback time in seconds */
  public getCurrentTime(): number {
    return this.videoElement ? this.videoElement.currentTime : 0;
  }

  /** Pauses the video playback. */
  public pause(): void {
    if (this.videoElement) this.videoElement.pause();
  }

  /** Returns video parent container for overlay mounting */
  public getContainer(): HTMLElement | null {
    if (!this.videoElement) return null;
    const ytContainer = (document.getElementById('movie_player') ||
      this.videoElement.closest('.html5-video-player') ||
      this.videoElement.closest('#ytd-player') ||
      this.videoElement.parentElement) as HTMLElement | null;
    return ytContainer;
  }

  public destroy(): void {
    if (this.observerInterval !== null) {
      clearInterval(this.observerInterval);
      this.observerInterval = null;
    }
    if (this.videoElement) {
      this.unbindVideoEvents(this.videoElement);
      this.videoElement = null;
    }
    this.timeUpdateCallbacks.clear();
  }
}
