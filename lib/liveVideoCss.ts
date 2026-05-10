/**
 * Live-video CSS injector — call once at app boot.
 *
 * Hides browser-native media controls (play overlay button, panel, scrubber)
 * on any <video> element with class="aspire-live-video". Use this class on:
 *   - Live MediaStream renders (camera previews, Anam video chat tile)
 *   - Pre-recorded LOOPING avatars (Ava orb, Finn orb)
 *   - Anything that plays autoPlay + loop and should NEVER expose UA controls
 *
 * Why this is needed despite controls={false} on the JSX:
 *   - Safari iOS shows a giant native overlay play button on any <video> the
 *     UA decides "needs user interaction" — autoplay-failed videos, paused
 *     videos, videos with stalled decode. controls={false} only hides the
 *     scrubber bar, not the overlay button.
 *   - Android Chrome similarly renders a center-play overlay until the first
 *     successful play() call resolves.
 *
 * The pseudo-element list below covers WebKit (Safari iPad/iPhone, Chromium
 * before flag flip) and Mozilla (Firefox Android tablets). All five rules
 * are needed — different iOS/Safari versions surface different pseudo-elements.
 */

import { Platform } from 'react-native';

const STYLE_ID = 'aspire-live-video-css';

export function ensureLiveVideoCssInstalled(): void {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    video.aspire-live-video::-webkit-media-controls,
    video.aspire-live-video::-webkit-media-controls-enclosure,
    video.aspire-live-video::-webkit-media-controls-panel,
    video.aspire-live-video::-webkit-media-controls-start-playback-button,
    video.aspire-live-video::-webkit-media-controls-overlay-play-button,
    video.aspire-live-video::-webkit-media-controls-play-button,
    video.aspire-live-video::-webkit-media-controls-fullscreen-button,
    video.aspire-live-video::-webkit-media-controls-mute-button,
    video.aspire-live-video::-webkit-media-controls-timeline,
    video.aspire-live-video::-webkit-media-controls-current-time-display,
    video.aspire-live-video::-webkit-media-controls-time-remaining-display,
    video.aspire-live-video::-webkit-media-controls-toggle-closed-captions-button {
      display: none !important;
      -webkit-appearance: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    video.aspire-live-video::-moz-media-controls,
    video.aspire-live-video::-moz-media-controls-button-row,
    video.aspire-live-video::-moz-media-controls-play-button {
      display: none !important;
    }
    /* Disables the centered play-button graphic injected by some Android
       Chrome builds when autoplay is queued but not yet started. */
    video.aspire-live-video {
      -webkit-tap-highlight-color: transparent;
    }
  `;
  document.head.appendChild(style);
}
