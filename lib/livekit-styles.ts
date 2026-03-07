/**
 * LiveKit CSS Injection for Aspire Dark Theme
 *
 * Since Expo web uses Metro bundler (no CSS import pipeline),
 * we inject LiveKit component styles at runtime via DOM injection.
 * This pattern is already used in AvaOrbVideo.tsx and AvaDeskPanel.tsx.
 *
 * Two style tags are injected:
 * 1. LIVEKIT_BASE_CSS — structural layout from @livekit/components-styles
 *    (display:flex/grid, sizing, positioning, box-model). Required by
 *    prefab components like <PreJoin> and <VideoConference>.
 * 2. LIVEKIT_ASPIRE_CSS — Aspire dark theme overrides (colors, borders,
 *    backgrounds). Loaded second so !important rules take precedence.
 */
import { Platform } from 'react-native';

const LIVEKIT_BASE_STYLE_ID = 'livekit-base-styles';
const LIVEKIT_STYLE_ID = 'livekit-aspire-theme';

/**
 * Base structural CSS from @livekit/components-styles/dist/general/index.css
 * Required for prefab components (PreJoin, VideoConference) to render with
 * proper layout. Without this, components appear as unstyled raw HTML.
 */
const LIVEKIT_BASE_CSS = `[data-lk-theme]{font-size:var(--lk-font-size);font-family:var(--lk-font-family);color:var(--lk-fg)}[data-lk-theme] .lk-list{list-style:none;margin:0;padding:0}[data-lk-theme] .lk-form-control{font-family:var(--lk-font-family);padding:.625rem 1rem;background-color:var(--lk-control-bg);border:1px solid var(--lk-border-color);border-radius:var(--lk-border-radius)}[data-lk-theme=default]{color-scheme:dark;--lk-bg: #111;--lk-bg2: rgb(29.75, 29.75, 29.75);--lk-bg3: rgb(42.5, 42.5, 42.5);--lk-bg4: rgb(55.25, 55.25, 55.25);--lk-bg5: #444444;--lk-fg: #fff;--lk-fg2: rgb(244.8, 244.8, 244.8);--lk-fg3: rgb(234.6, 234.6, 234.6);--lk-fg4: rgb(224.4, 224.4, 224.4);--lk-fg5: rgb(214.2, 214.2, 214.2);--lk-border-color: rgba(255, 255, 255, 0.1);--lk-accent-fg: #fff;--lk-accent-bg: #1f8cf9;--lk-accent2: rgb(50.867826087, 150.2, 249.532173913);--lk-accent3: rgb(70.7356521739, 160.4, 250.0643478261);--lk-accent4: rgb(90.6034782609, 170.6, 250.5965217391);--lk-danger-fg: #fff;--lk-danger: #f91f31;--lk-danger2: rgb(249.532173913, 50.867826087, 67.2713043478);--lk-danger3: rgb(250.0643478261, 70.7356521739, 85.5426086957);--lk-danger4: rgb(250.5965217391, 90.6034782609, 103.8139130435);--lk-success-fg: #fff;--lk-success: #1ff968;--lk-success2: rgb(50.867826087, 249.532173913, 117.3930434783);--lk-success3: rgb(70.7356521739, 250.0643478261, 130.7860869565);--lk-success4: rgb(90.6034782609, 250.5965217391, 144.1791304348);--lk-control-fg: var(--lk-fg);--lk-control-bg: var(--lk-bg2);--lk-control-hover-bg: var(--lk-bg3);--lk-control-active-bg: var(--lk-bg4);--lk-control-active-hover-bg: var(--lk-bg5);--lk-connection-excellent: #06db4d;--lk-connection-good: #f9b11f;--lk-connection-poor: #f91f31;--lk-font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";--lk-font-size: 16px;--lk-line-height: 1.5;--lk-border-radius: 0.5rem;--lk-box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.15);--lk-drop-shadow: rgba(255, 255, 255, 0.2) 0px 0px 24px;--lk-grid-gap: 0.5rem;--lk-control-bar-height: 69px;--lk-chat-header-height: 69px}.lk-button,.lk-start-audio-button,.lk-chat-toggle,.lk-disconnect-button{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.625rem 1rem;color:var(--lk-control-fg);background-image:none;background-color:var(--lk-control-bg);border:0;border-radius:var(--lk-border-radius);cursor:pointer;white-space:nowrap;font-size:inherit;line-height:inherit;user-select:none}.lk-button:not(:disabled):hover,.lk-start-audio-button:not(:disabled):hover,.lk-chat-toggle:not(:disabled):hover,.lk-disconnect-button:not(:disabled):hover{background-color:var(--lk-control-hover-bg)}.lk-button>svg,.lk-start-audio-button>svg,.lk-chat-toggle>svg,.lk-disconnect-button>svg{overflow:visible}.lk-button[aria-pressed=true],[aria-pressed=true].lk-start-audio-button,[aria-pressed=true].lk-chat-toggle,[aria-pressed=true].lk-disconnect-button{background-color:var(--lk-control-active-bg)}.lk-button[aria-pressed=true]:hover,[aria-pressed=true].lk-start-audio-button:hover,[aria-pressed=true].lk-chat-toggle:hover,[aria-pressed=true].lk-disconnect-button:hover{background-color:var(--lk-control-active-hover-bg)}.lk-button[data-lk-source=screen_share][data-lk-enabled=true],[data-lk-source=screen_share][data-lk-enabled=true].lk-start-audio-button,[data-lk-source=screen_share][data-lk-enabled=true].lk-chat-toggle,[data-lk-source=screen_share][data-lk-enabled=true].lk-disconnect-button{background-color:var(--lk-accent-bg)}.lk-button[data-lk-source=screen_share][data-lk-enabled=true]:hover,[data-lk-source=screen_share][data-lk-enabled=true].lk-start-audio-button:hover,[data-lk-source=screen_share][data-lk-enabled=true].lk-chat-toggle:hover,[data-lk-source=screen_share][data-lk-enabled=true].lk-disconnect-button:hover{background-color:var(--lk-accent2)}.lk-button:disabled,.lk-start-audio-button:disabled,.lk-chat-toggle:disabled,.lk-disconnect-button:disabled{opacity:.5}.lk-button-group{display:inline-flex;align-items:stretch;height:100%}.lk-button-group>.lk-button:first-child,.lk-button-group>.lk-start-audio-button:first-child,.lk-button-group>.lk-chat-toggle:first-child,.lk-button-group>.lk-disconnect-button:first-child{border-top-right-radius:0;border-bottom-right-radius:0}.lk-button-group-menu{position:relative;flex-shrink:0}.lk-button-group-menu>.lk-button,.lk-button-group-menu>.lk-start-audio-button,.lk-button-group-menu>.lk-chat-toggle,.lk-button-group-menu>.lk-disconnect-button{height:100%;border-top-left-radius:0;border-bottom-left-radius:0}.lk-button-group-menu>.lk-button::after,.lk-button-group-menu>.lk-start-audio-button::after,.lk-button-group-menu>.lk-chat-toggle::after,.lk-button-group-menu>.lk-disconnect-button::after{margin-left:0}.lk-button-menu::after{display:inline-block;content:"";width:.5em;height:.5em;margin-top:-0.25rem;margin-left:.5rem;border-left:.125em solid;border-bottom:.125em solid;transform:rotate(-45deg);transform-origin:center center}.lk-disconnect-button{font-weight:600;color:var(--lk-danger);border:1px solid var(--lk-danger)}.lk-disconnect-button:not(:disabled):hover{--lk-control-hover-bg: var(--lk-danger2);color:var(--lk-danger-fg)}.lk-disconnect-button:not(:disabled):active{--lk-control-hover-bg: var(--lk-danger3);color:var(--lk-danger-fg)}.lk-chat-toggle{position:relative}.lk-chat-toggle[data-lk-unread-msgs]:not([data-lk-unread-msgs="0"]):after{content:attr(data-lk-unread-msgs);position:absolute;top:0;left:0;padding:.25rem;margin-left:.25rem;margin-top:.25rem;border-radius:50%;font-size:.5rem;line-height:.75;background:var(--lk-accent-bg)}.lk-media-device-select:not(:last-child){padding-bottom:.5rem;margin-bottom:.75rem;border-bottom:1px solid var(--lk-border-color)}.lk-media-device-select li:not(:last-child){margin-bottom:.25rem}.lk-media-device-select li>.lk-button{width:100%;justify-content:start;padding-block:.5rem}.lk-media-device-select li:not([data-lk-active=true])>.lk-button:not(:disabled):hover{background-color:var(--lk-bg3)}.lk-media-device-select [data-lk-active=false]>.lk-button:hover{cursor:pointer;background-color:rgba(0,0,0,.05)}.lk-media-device-select [data-lk-active=true]>.lk-button{color:var(--lk-accent-fg);background-color:var(--lk-accent-bg)}.lk-device-menu{width:max-content;position:absolute;top:0;left:0;z-index:5;min-width:10rem;padding:.5rem;margin-bottom:.25rem;white-space:nowrap;background-color:var(--lk-bg2);border:1px solid var(--lk-border-color);border-radius:.75rem;box-shadow:var(--lk-box-shadow)}.lk-device-menu-heading{padding:.25rem .5rem;font-weight:bold;opacity:.65}.lk-start-audio-button{color:var(--lk-accent-fg);background-color:var(--lk-accent-bg)}@media screen and (max-width: 600px){.lk-start-audio-button{position:fixed;top:50%;left:50%;transform:translate(-50%, -50%)}}.lk-pagination-control{position:absolute;bottom:1rem;left:50%;transform:translateX(-50%);display:flex;align-items:stretch;background-color:var(--lk-control-bg);border-radius:var(--lk-border-radius);transition:opacity ease-in-out .15s;opacity:0}.lk-pagination-control:hover{opacity:1}.lk-pagination-control>.lk-button:first-child{border-top-right-radius:0;border-bottom-right-radius:0}.lk-pagination-control>.lk-button:first-child>svg{transform:rotate(180deg)}.lk-pagination-control>.lk-button:last-child{border-top-left-radius:0;border-bottom-left-radius:0}.lk-pagination-count{padding:.5rem .875rem;border-inline:1px solid var(--lk-bg)}[data-lk-user-interaction=true].lk-pagination-control{opacity:1}.lk-pagination-indicator{position:absolute;height:var(--lk-grid-gap);background-color:var(--lk-bg2);width:fit-content;padding:.2rem .5rem;bottom:calc(var(--lk-grid-gap)/2);left:50%;transform:translateX(-50%);border-radius:2rem;opacity:1;display:flex;gap:.2rem;align-items:center}.lk-pagination-indicator span{display:inline-block;width:.4rem;height:.4rem;border-radius:9999999px;background-color:var(--lk-fg);opacity:.35;transition:opacity linear .2s}.lk-pagination-indicator span[data-lk-active]{opacity:.9}.lk-grid-layout{--lk-col-count: 1;--lk-row-count: 1;display:grid;grid-template-columns:repeat(var(--lk-col-count), minmax(0, 1fr));grid-auto-rows:minmax(0, 1fr);grid-gap:var(--lk-grid-gap);width:100%;height:100%;max-width:100%;max-height:100%;padding:var(--lk-grid-gap)}.lk-grid-layout[data-lk-pagination=true]{padding-bottom:calc(var(--lk-grid-gap)*2)}.lk-focus-layout{display:grid;grid-template-columns:1fr 5fr;gap:var(--lk-grid-gap);width:100%;max-height:100%;padding:var(--lk-grid-gap)}.lk-focused-participant{position:relative}.lk-focused-participant .lk-pip-track{position:absolute;top:10px;right:10px;width:20%;height:auto}@media(max-width: 600px){.lk-focus-layout{grid-template-columns:1fr;grid-template-rows:5fr 1fr}.lk-carousel{order:1}}.lk-carousel{max-height:100%;display:flex;gap:var(--lk-grid-gap)}.lk-carousel>*{flex-shrink:0;aspect-ratio:16/10;scroll-snap-align:start}.lk-carousel[data-lk-orientation=vertical]{flex-direction:column;scroll-snap-type:y mandatory;overflow-y:auto;overflow-x:hidden}.lk-carousel[data-lk-orientation=vertical]>*{--lk-height-minus-gaps: calc(100% - calc(var(--lk-grid-gap) * calc(var(--lk-max-visible-tiles) - 1)));height:calc(var(--lk-height-minus-gaps)/var(--lk-max-visible-tiles))}.lk-carousel[data-lk-orientation=horizontal]{scroll-snap-type:x mandatory;overflow-y:hidden;overflow-x:auto}.lk-carousel[data-lk-orientation=horizontal]>*{--lk-width-minus-gaps: calc(100% - var(--lk-grid-gap) * (var(--lk-max-visible-tiles) - 1));width:calc(var(--lk-width-minus-gaps)/var(--lk-max-visible-tiles))}.lk-connection-quality{width:1.5rem;height:1.5rem}.lk-track-muted-indicator-camera,.lk-track-muted-indicator-microphone{position:relative;width:var(--lk-indicator-size, 1rem);height:var(--lk-indicator-size, 1rem);margin-inline-end:.25rem;transition:opacity .25s ease-in-out}.lk-track-muted-indicator-camera[data-lk-muted=true]{opacity:.5}.lk-track-muted-indicator-microphone{--lk-bg: var(--lk-icon-mic)}.lk-track-muted-indicator-microphone[data-lk-muted=true]{opacity:.5}.lk-participant-name{font-size:.875rem}.lk-participant-media-video{width:100%;height:100%;object-fit:cover;object-position:center;background-color:#000}.lk-participant-media-video[data-lk-orientation=landscape]{object-fit:cover}.lk-participant-media-video[data-lk-orientation=portrait],.lk-participant-media-video[data-lk-source=screen_share]{object-fit:contain;background-color:var(--lk-bg2)}.lk-participant-media-audio{width:auto}[data-lk-facing-mode=user] .lk-participant-media-video[data-lk-local-participant=true][data-lk-source=camera]{transform:rotateY(180deg)}.lk-audio-visualizer{width:100%;height:100%;min-height:160px;background:var(--lk-bg-control);aspect-ratio:16/9;border-radius:.5rem;display:flex;justify-content:space-around;align-items:center}.lk-audio-visualizer>rect{fill:var(--lk-accent-bg);transition:transform 100ms cubic-bezier(0.19, 0.02, 0.09, 1)}.lk-audio-visualizer>path{stroke:var(--lk-accent-bg);transition:100ms cubic-bezier(0.19, 0.02, 0.09, 1)}.lk-audio-bar-visualizer{display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:var(--lk-bg);gap:var(--lk-va-bar-gap, 24px)}.lk-audio-bar-visualizer>.lk-audio-bar{transform-origin:"center";height:100%;width:var(--lk-va-bar-width, 12px);border-radius:var(--lk-va-bar-border-radius, 32px);background-color:var(--lk-va-bar-bg, rgba(136, 136, 136, 0.2));transition:background-color .25s ease-out}.lk-audio-bar-visualizer[data-lk-va-state=speaking]>.lk-audio-bar,.lk-audio-bar-visualizer>.lk-audio-bar.lk-highlighted,.lk-audio-bar-visualizer>[data-lk-highlighted=true]{background-color:var(--lk-fg, rgb(136, 136, 136));transition:none}.lk-audio-bar-visualizer[data-lk-va-state=thinking]{transition:background-color .15s ease-out}.lk-participant-tile{--lk-speaking-indicator-width: 2.5px;position:relative;display:flex;flex-direction:column;gap:.375rem;overflow:hidden;border-radius:var(--lk-border-radius)}.lk-participant-tile::after{content:"";position:absolute;top:0;bottom:0;left:0;right:0;border-radius:var(--lk-border-radius);border:0px solid var(--lk-accent-bg);transition-property:border opacity;transition-delay:.5s;transition-duration:.4s;pointer-events:none}.lk-participant-tile[data-lk-speaking=true]:not([data-lk-source=screen_share])::after{transition-delay:0s;transition-duration:.2s;border-width:var(--lk-speaking-indicator-width)}.lk-participant-tile .lk-focus-toggle-button{position:absolute;top:.25rem;right:.25rem;padding:.25rem;background-color:rgba(0,0,0,.5);border-radius:calc(var(--lk-border-radius)/2);opacity:0;transition:opacity .2s ease-in-out;transition-delay:.2s}.lk-participant-tile:hover .lk-focus-toggle-button,.lk-participant-tile:focus .lk-focus-toggle-button{opacity:1;transition-delay:0}.lk-participant-tile .lk-connection-quality{opacity:0;transition:opacity .2s ease-in-out;transition-delay:.2s}.lk-participant-tile .lk-connection-quality[data-lk-quality=poor]{opacity:1;transition-delay:0}.lk-participant-tile:hover .lk-connection-quality,.lk-participant-tile:focus .lk-connection-quality{opacity:1;transition-delay:0}.lk-participant-tile .lk-participant-placeholder{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background-color:var(--lk-bg2);opacity:0;transition:opacity .2s ease-in-out;pointer-events:none;border-radius:var(--lk-border-radius)}.lk-participant-tile .lk-participant-placeholder svg{height:100%;width:auto;padding:10%}.lk-participant-tile[data-lk-video-muted=true][data-lk-source=camera] .lk-participant-placeholder{opacity:1}.lk-participant-metadata{position:absolute;right:.25rem;bottom:.25rem;left:.25rem;display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:.5rem;line-height:1}.lk-participant-metadata-item{display:flex;align-items:center;padding:.25rem;background-color:rgba(0,0,0,.5);border-radius:calc(var(--lk-border-radius)/2)}.lk-toast{position:fixed;top:.75rem;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:.5rem;padding:.75rem 1.25rem;background-color:var(--lk-bg);border:1px solid var(--lk-border-color);border-radius:var(--lk-border-radius);box-shadow:var(--lk-box-shadow)}.lk-spinner{animation:lk-rotate 2s infinite linear}@keyframes lk-rotate{from{transform:rotate(0deg)}to{transform:rotate(359deg)}}.lk-room-container{background-color:var(--lk-bg);line-height:var(--lk-line-height)}[data-lk-theme]{font-size:var(--lk-font-size);font-family:var(--lk-font-family);color:var(--lk-fg)}[data-lk-theme] .lk-list{list-style:none;margin:0;padding:0}[data-lk-theme] .lk-form-control{font-family:var(--lk-font-family);padding:.625rem 1rem;background-color:var(--lk-control-bg);border:1px solid var(--lk-border-color);border-radius:var(--lk-border-radius)}.lk-room-container{position:relative;width:100%;height:100%;--lk-has-imported-styles: "true"}.lk-room-container *[class^=lk-],.lk-room-container *[class*=" lk-"]{box-sizing:border-box}.lk-audio-conference{position:relative;width:100%;height:100%}.lk-audio-conference-stage{width:100%;height:100%;display:grid;grid-template-columns:repeat(3, 1fr);gap:10px}.lk-chat{display:grid;grid-template-rows:var(--lk-chat-header-height) 1fr var(--lk-control-bar-height);width:clamp(200px,55ch,60ch);background-color:var(--lk-bg2);border-left:1px solid var(--lk-border-color);align-items:end}.lk-chat-header{height:var(--lk-chat-header-height);padding:.75rem;position:relative;display:flex;align-items:center;justify-content:center}.lk-chat-header .lk-close-button{position:absolute;right:0;transform:translateX(-50%);background-color:rgba(0,0,0,0)}.lk-chat-header .lk-close-button:hover{background-color:var(--lk-control-active-hover-bg)}.lk-chat-messages{display:flex;width:100%;max-height:100%;flex-direction:column;gap:.25rem;overflow:auto}.lk-chat-entry{display:flex;flex-direction:column;gap:.25rem;margin:0 .25rem}.lk-chat-entry .lk-meta-data{font-size:.75rem;color:var(--lk-fg5);white-space:nowrap;padding:0 .3rem;display:flex}.lk-chat-entry .lk-meta-data .lk-participant-name{margin-top:1rem}.lk-chat-entry .lk-meta-data .lk-timestamp{margin-left:auto;align-self:flex-end}.lk-chat-entry .lk-edit-button{background:none;float:right;margin:0;padding:0 .25rem;border-radius:0;font-size:12px}.lk-chat-entry .lk-message-body{display:inline-block;border-radius:15px;padding:.25rem .75rem;word-break:break-word;width:fit-content;max-width:calc(100% - 32px)}.lk-chat-entry[data-lk-message-origin=local] .lk-message-body{background-color:var(--lk-bg5)}.lk-chat-entry[data-lk-message-origin=remote] .lk-message-body{background-color:var(--lk-accent4)}.lk-chat-entry a{text-decoration:underline;color:inherit}.lk-chat-entry *{margin-block-start:.25em;margin-block-end:.25em}.lk-chat-entry:last-child{margin-bottom:.25rem}.lk-chat-form{display:flex;gap:.75rem;padding:.75rem;border-top:1px solid var(--lk-border-color);max-height:var(--lk-control-bar-height)}.lk-chat-form-input{font-size:inherit;line-height:inherit;width:100%}@media(max-width: 600px){.lk-chat{position:fixed;top:0;right:0;max-width:100%;bottom:var(--lk-control-bar-height)}}.lk-control-bar,.lk-agent-control-bar{display:flex;gap:.5rem;align-items:center;justify-content:center;padding:.75rem;border-top:1px solid var(--lk-border-color);max-height:var(--lk-control-bar-height)}.lk-agent-control-bar{height:var(--lk-control-bar-height);--lk-bg: transparent;--lk-va-bar-width: 2px;--lk-va-bar-gap: 4px;--lk-va-bar-border-radius: 1px}.lk-agent-control-bar .lk-audio-bar-visualizer .lk-audio-bar.lk-highlighted{filter:none}.lk-prejoin{background-color:var(--lk-bg);line-height:var(--lk-line-height)}[data-lk-theme]{font-size:var(--lk-font-size);font-family:var(--lk-font-family);color:var(--lk-fg)}[data-lk-theme] .lk-list{list-style:none;margin:0;padding:0}[data-lk-theme] .lk-form-control{font-family:var(--lk-font-family);padding:.625rem 1rem;background-color:var(--lk-control-bg);border:1px solid var(--lk-border-color);border-radius:var(--lk-border-radius)}.lk-prejoin{box-sizing:border-box;display:flex;flex-direction:column;align-items:center;padding:1rem;gap:1rem;margin-inline:auto;background-color:var(--lk-bg);width:min(100%,480px);align-items:stretch}.lk-prejoin .lk-video-container{position:relative;width:100%;height:auto;aspect-ratio:16/10;background-color:#000;border-radius:var(--lk-border-radius);overflow:hidden}.lk-prejoin .lk-video-container video,.lk-prejoin .lk-video-container .lk-camera-off-note{display:block;width:100%;height:100%;object-fit:cover}.lk-prejoin .lk-video-container video[data-lk-facing-mode=user]{transform:rotateY(180deg)}.lk-prejoin .lk-video-container .lk-camera-off-note{position:absolute;top:0px;left:0px;width:100%;aspect-ratio:16/10;background-color:#000;display:grid;place-items:center}.lk-prejoin .lk-video-container .lk-camera-off-note>*{height:70%;max-width:100%}.lk-prejoin .lk-audio-container{display:none}.lk-prejoin .lk-audio-container audio{width:100%;height:auto}.lk-prejoin .lk-button-group-container{display:flex;flex-wrap:nowrap;gap:1rem}.lk-prejoin .lk-button-group-container>.lk-button-group{width:50%}.lk-prejoin .lk-button-group-container>.lk-button-group>.lk-button{justify-content:left}.lk-prejoin .lk-button-group-container>.lk-button-group>.lk-button:first-child{width:100%}@media(max-width: 400px){.lk-prejoin .lk-button-group-container{flex-wrap:wrap}.lk-prejoin .lk-button-group-container>.lk-button-group{width:100%}}.lk-prejoin .lk-username-container{display:flex;flex-direction:column;gap:1rem;width:100%;max-width:100%}.lk-prejoin .lk-join-button{--lk-control-fg: var(--lk-accent-fg);--lk-control-bg: var(--lk-accent-bg);--lk-control-hover-bg: var(--lk-accent2);--lk-control-active-bg: var(--lk-accent3);--lk-control-active-hover-bg: var(--lk-accent4);background-color:var(--lk-control-bg)}.lk-prejoin .lk-join-button:hover{background-color:var(--lk-control-hover-bg)}.lk-focus-layout-wrapper,.lk-grid-layout-wrapper{position:relative;display:flex;justify-content:center;width:100%;height:calc(100% - var(--lk-control-bar-height))}.lk-grid-layout-wrapper{flex-direction:column;align-items:center}.lk-focus-layout-wrapper{align-items:stretch}.lk-video-conference{position:relative;display:flex;align-items:stretch;height:100%}.lk-video-conference-inner{display:flex;flex-direction:column;align-items:stretch;width:100%}.lk-settings-menu-modal{position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:var(--lk-bg);padding:1rem;border-radius:var(--lk-border-radius);display:flex;flex-direction:column;align-items:center;gap:.5rem;padding:.75rem 1.25rem;background-color:var(--lk-bg);border:1px solid var(--lk-border-color);border-radius:var(--lk-border-radius);box-shadow:var(--lk-box-shadow);min-width:50vw;min-height:50vh;max-width:100%;max-height:100%;overflow-y:auto}`;

const LIVEKIT_ASPIRE_CSS = `
/* ═══════════════════════════════════════════════════════════════════════════
 * LiveKit Components — Aspire Premium Dark Theme Overrides
 * ═══════════════════════════════════════════════════════════════════════════
 * Aspire Design Tokens:
 *   Background: #0a0a0c (deep), #141414 (surface), #1C1C1E (elevated), #2C2C2E (border)
 *   Text: #ffffff (primary), #D4D4D8 (secondary), #9CA3AF (tertiary), #6B7280 (muted)
 *   Green: #22C55E (primary), #16A34A (hover), #34C759 (success)
 *   Blue: #3B82F6 (accent), #2563EB (hover)
 *   Red: #FF3B30 (danger), #DC2626 (hover)
 *   Cyan: #4FACFE (focus rings)
 *   Radius: 10px (cards), 8px (buttons), 12px (containers)
 *   Transition: 0.2s ease (hover), 0.3s ease (state)
 *   Glassmorphism: rgba(20,20,20,0.85) + backdrop-filter:blur(12px)
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ── Aspire keyframes for LiveKit components ───────────────────────────── */
@keyframes aspire-lk-fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes aspire-lk-speakingPulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(52, 199, 89, 0.6), 0 0 12px rgba(52, 199, 89, 0.2); }
  50% { box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.8), 0 0 20px rgba(52, 199, 89, 0.35); }
}
@keyframes aspire-lk-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes aspire-lk-spinnerRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── CSS Custom Properties — Aspire overrides ──────────────────────────── */
[data-lk-theme="default"] {
  --lk-bg: #0a0a0c;
  --lk-bg2: #141414;
  --lk-bg3: #1C1C1E;
  --lk-bg4: #242426;
  --lk-bg5: #2C2C2E;
  --lk-control-bg: rgba(20, 20, 20, 0.85);
  --lk-control-hover-bg: #1C1C1E;
  --lk-control-active-bg: #242426;
  --lk-control-active-hover-bg: #2C2C2E;
  --lk-fg: #ffffff;
  --lk-fg2: #f2f2f2;
  --lk-fg3: #D4D4D8;
  --lk-fg4: #9CA3AF;
  --lk-fg5: #6B7280;
  --lk-border-color: #2C2C2E;
  --lk-accent-bg: #3B82F6;
  --lk-accent-fg: #ffffff;
  --lk-accent2: #2563EB;
  --lk-accent3: #1D4ED8;
  --lk-accent4: rgba(59, 130, 246, 0.2);
  --lk-danger: #FF3B30;
  --lk-danger-fg: #ffffff;
  --lk-danger2: #DC2626;
  --lk-danger3: #B91C1C;
  --lk-success: #22C55E;
  --lk-success2: #16A34A;
  --lk-connection-excellent: #22C55E;
  --lk-connection-good: #EAB308;
  --lk-connection-poor: #FF3B30;
  --lk-border-radius: 10px;
  --lk-grid-gap: 4px;
  --lk-box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  --lk-drop-shadow: rgba(59, 130, 246, 0.15) 0px 0px 16px;
  --lk-font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* ── Room Container ────────────────────────────────────────────────────── */
.lk-room-container {
  background: #0a0a0c !important;
  height: 100% !important;
  width: 100% !important;
  display: flex !important;
  flex-direction: column !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PARTICIPANT TILES — Premium rounded dark cards with smooth states
 * ═══════════════════════════════════════════════════════════════════════════ */
.lk-participant-tile {
  border-radius: 10px !important;
  overflow: hidden !important;
  background: #141414 !important;
  transition: box-shadow 0.3s ease, transform 0.2s ease !important;
}

.lk-participant-tile video {
  border-radius: 10px !important;
  object-fit: contain !important;
  background: #0a0a0c !important;
}

/* Speaking indicator — animated green glow (not harsh border) */
.lk-participant-tile[data-lk-speaking="true"]:not([data-lk-source="screen_share"]) {
  animation: aspire-lk-speakingPulse 1.8s ease-in-out infinite !important;
}
/* Override the base ::after border approach — we use box-shadow glow instead */
.lk-participant-tile[data-lk-speaking="true"]::after {
  border-width: 0px !important;
}

/* Camera-off placeholder — elegant dark surface with subtle pattern */
.lk-participant-tile .lk-participant-placeholder {
  background: linear-gradient(135deg, #141414 0%, #1C1C1E 100%) !important;
  border-radius: 10px !important;
}
.lk-participant-tile .lk-participant-placeholder svg {
  opacity: 0.3 !important;
  padding: 25% !important;
  filter: grayscale(1) brightness(0.8) !important;
}

/* Participant metadata bar — refined glass overlay */
.lk-participant-metadata {
  padding: 4px 8px !important;
  gap: 4px !important;
}
.lk-participant-metadata-item {
  background: rgba(0, 0, 0, 0.55) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border-radius: 6px !important;
  padding: 3px 6px !important;
}

/* Participant name — text shadow for readability over video */
.lk-participant-name {
  font-size: 13px !important;
  font-weight: 500 !important;
  color: #D4D4D8 !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6) !important;
  letter-spacing: 0.01em !important;
}

/* Focus ring — Aspire cyan accent */
.lk-participant-tile .lk-focus-ring {
  border-color: #4FACFE !important;
}

/* Focus toggle button — smooth reveal */
.lk-participant-tile .lk-focus-toggle-button {
  background: rgba(0, 0, 0, 0.6) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border-radius: 6px !important;
  transition: opacity 0.2s ease, background 0.2s ease !important;
}
.lk-participant-tile .lk-focus-toggle-button:hover {
  background: rgba(59, 130, 246, 0.25) !important;
}

/* Connection quality — color-coded with smooth reveal */
.lk-connection-quality {
  transition: opacity 0.2s ease !important;
}
.lk-connection-quality svg {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4)) !important;
}
.lk-connection-quality[data-lk-quality="excellent"] {
  color: #22C55E !important;
}
.lk-connection-quality[data-lk-quality="good"] {
  color: #EAB308 !important;
}
.lk-connection-quality[data-lk-quality="poor"] {
  color: #FF3B30 !important;
}

/* Mute indicators — subtle refinement */
.lk-track-muted-indicator-camera,
.lk-track-muted-indicator-microphone {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3)) !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * GRID LAYOUT — Precise gaps, clean composition
 * ═══════════════════════════════════════════════════════════════════════════ */
.lk-grid-layout {
  gap: 4px !important;
  padding: 6px !important;
  background: #0a0a0c !important;
}

/* Focus layout (speaker + sidebar) */
.lk-focus-layout {
  background: #0a0a0c !important;
  gap: 4px !important;
}

/* Carousel sidebar tiles */
.lk-carousel {
  gap: 4px !important;
}
.lk-carousel::-webkit-scrollbar {
  width: 4px !important;
  height: 4px !important;
}
.lk-carousel::-webkit-scrollbar-track {
  background: transparent !important;
}
.lk-carousel::-webkit-scrollbar-thumb {
  background: #2C2C2E !important;
  border-radius: 2px !important;
}

/* Pagination controls */
.lk-pagination-control {
  background: rgba(20, 20, 20, 0.85) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  border-radius: 8px !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
}
.lk-pagination-indicator {
  background: rgba(20, 20, 20, 0.7) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CONTROL BAR — Glassmorphism, premium buttons, proper disconnect styling
 * ═══════════════════════════════════════════════════════════════════════════ */
.lk-control-bar {
  background: rgba(20, 20, 20, 0.85) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
  padding: 10px 24px !important;
  gap: 6px !important;
}

/* All control bar buttons — unified styling */
.lk-control-bar .lk-button,
.lk-control-bar .lk-chat-toggle,
.lk-control-bar .lk-start-audio-button {
  border-radius: 8px !important;
  background: transparent !important;
  color: #ffffff !important;
  border: 1px solid transparent !important;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease !important;
  min-width: 44px !important;
  min-height: 44px !important;
  padding: 8px 12px !important;
}
.lk-control-bar .lk-button:hover,
.lk-control-bar .lk-chat-toggle:hover,
.lk-control-bar .lk-start-audio-button:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
}
.lk-control-bar .lk-button:active,
.lk-control-bar .lk-chat-toggle:active,
.lk-control-bar .lk-start-audio-button:active {
  transform: scale(0.96) !important;
}

/* Muted state (mic off, camera off) — subtle red tint */
.lk-control-bar .lk-button[aria-pressed="true"],
.lk-control-bar .lk-button[data-lk-enabled="false"] {
  background: rgba(255, 59, 48, 0.08) !important;
  color: #FF3B30 !important;
}
.lk-control-bar .lk-button[aria-pressed="true"]:hover,
.lk-control-bar .lk-button[data-lk-enabled="false"]:hover {
  background: rgba(255, 59, 48, 0.14) !important;
}

/* Screen share active — blue accent */
.lk-control-bar .lk-button[data-lk-source="screen_share"][data-lk-enabled="true"] {
  background: rgba(59, 130, 246, 0.15) !important;
  color: #3B82F6 !important;
  border-color: rgba(59, 130, 246, 0.2) !important;
}

/* Chat toggle — unread badge */
.lk-chat-toggle[data-lk-unread-msgs]:not([data-lk-unread-msgs="0"])::after {
  background: #FF3B30 !important;
  min-width: 16px !important;
  height: 16px !important;
  font-size: 9px !important;
  font-weight: 700 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 8px !important;
  border: 2px solid #0a0a0c !important;
  padding: 0 3px !important;
}

/* Disconnect button — prominent danger styling */
.lk-disconnect-button {
  background: rgba(255, 59, 48, 0.12) !important;
  color: #FF3B30 !important;
  border: 1px solid rgba(255, 59, 48, 0.25) !important;
  border-radius: 8px !important;
  font-weight: 600 !important;
  min-width: 44px !important;
  min-height: 44px !important;
  padding: 8px 16px !important;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease !important;
}
.lk-disconnect-button:hover {
  background: rgba(255, 59, 48, 0.22) !important;
  border-color: rgba(255, 59, 48, 0.4) !important;
  color: #ffffff !important;
}
.lk-disconnect-button:active {
  background: #DC2626 !important;
  color: #ffffff !important;
  transform: scale(0.96) !important;
}

/* Button group container — device selectors in control bar */
.lk-button-group {
  border-radius: 8px !important;
  overflow: hidden !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
}
.lk-button-group-menu > .lk-button,
.lk-button-group-menu > .lk-chat-toggle,
.lk-button-group-menu > .lk-disconnect-button {
  border-left: 1px solid rgba(255, 255, 255, 0.06) !important;
}

/* Device dropdown menu — premium dark panel */
.lk-device-menu {
  background: #141414 !important;
  border: 1px solid #2C2C2E !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  padding: 6px !important;
}
.lk-device-menu-heading {
  color: #6B7280 !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
  padding: 6px 10px 4px !important;
}
.lk-media-device-select li > .lk-button {
  border-radius: 8px !important;
  padding: 8px 10px !important;
  font-size: 13px !important;
  transition: background 0.15s ease !important;
}
.lk-media-device-select li:not([data-lk-active="true"]) > .lk-button:hover {
  background: #1C1C1E !important;
}
.lk-media-device-select [data-lk-active="true"] > .lk-button {
  background: rgba(59, 130, 246, 0.12) !important;
  color: #3B82F6 !important;
}
.lk-media-device-select:not(:last-child) {
  border-color: rgba(255, 255, 255, 0.06) !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * FOCUS RING — Blue glow, not browser default
 * ═══════════════════════════════════════════════════════════════════════════ */
[data-lk-theme="default"] *:focus-visible {
  outline: none !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 8px rgba(59, 130, 246, 0.2) !important;
}
[data-lk-theme="default"] .lk-participant-tile:focus-visible {
  box-shadow: 0 0 0 2px rgba(79, 172, 254, 0.6), 0 0 12px rgba(79, 172, 254, 0.2) !important;
}
/* Remove focus ring from elements that trigger it confusingly */
[data-lk-theme="default"] .lk-participant-tile video:focus-visible,
[data-lk-theme="default"] .lk-grid-layout:focus-visible {
  box-shadow: none !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PREJOIN LOBBY — Camera preview, device selectors, join button, fade-in
 * ═══════════════════════════════════════════════════════════════════════════ */
.lk-prejoin {
  background: #0a0a0c !important;
  max-width: 480px !important;
  margin: 0 auto !important;
  padding: 24px !important;
  gap: 16px !important;
  animation: aspire-lk-fadeIn 0.4s ease-out both !important;
}

/* Camera preview — 16:10 aspect, rounded, subtle border */
.lk-prejoin .lk-video-container {
  border-radius: 12px !important;
  overflow: hidden !important;
  background: #141414 !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
}
.lk-prejoin .lk-video-container video {
  border-radius: 0 !important;
}

/* Camera-off note — elegant placeholder, not just black */
.lk-prejoin .lk-video-container .lk-camera-off-note {
  background: linear-gradient(135deg, #141414 0%, #1C1C1E 50%, #141414 100%) !important;
}
.lk-prejoin .lk-video-container .lk-camera-off-note > * {
  opacity: 0.25 !important;
  filter: grayscale(1) !important;
}

/* Device toggle buttons (mic/camera on/off) */
.lk-prejoin .lk-button-group {
  background: transparent !important;
  border: none !important;
}
.lk-prejoin .lk-button-group .lk-button {
  background: #1C1C1E !important;
  border: 1px solid #2C2C2E !important;
  color: #ffffff !important;
  border-radius: 8px !important;
  min-height: 44px !important;
  transition: background 0.2s ease, border-color 0.2s ease !important;
}
.lk-prejoin .lk-button-group .lk-button:hover {
  background: #242426 !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}
.lk-prejoin .lk-button-group .lk-button[aria-pressed="true"] {
  background: rgba(255, 59, 48, 0.08) !important;
  color: #FF3B30 !important;
  border-color: rgba(255, 59, 48, 0.15) !important;
}

/* Name input — premium styling with focus glow */
.lk-prejoin .lk-form-control {
  background: #141414 !important;
  border: 1px solid #2C2C2E !important;
  color: #ffffff !important;
  border-radius: 10px !important;
  padding: 14px 16px !important;
  font-size: 15px !important;
  transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
  -webkit-appearance: none !important;
}
.lk-prejoin .lk-form-control::placeholder {
  color: #6B7280 !important;
}
.lk-prejoin .lk-form-control:focus {
  border-color: rgba(59, 130, 246, 0.5) !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12), 0 0 12px rgba(59, 130, 246, 0.08) !important;
  outline: none !important;
}

/* Labels */
.lk-prejoin label,
.lk-prejoin .lk-form-control-label {
  color: #9CA3AF !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  letter-spacing: 0.02em !important;
}

/* Device selector dropdowns — custom styled (hide browser defaults) */
.lk-prejoin select,
.lk-prejoin .lk-form-control[is="select"],
.lk-device-menu select {
  background: #141414 !important;
  border: 1px solid #2C2C2E !important;
  color: #ffffff !important;
  border-radius: 8px !important;
  padding: 10px 32px 10px 12px !important;
  font-size: 13px !important;
  cursor: pointer !important;
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  appearance: none !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%236B7280' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 10px center !important;
  transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
}
.lk-prejoin select:focus,
.lk-device-menu select:focus {
  border-color: rgba(59, 130, 246, 0.5) !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12) !important;
  outline: none !important;
}
.lk-prejoin select:hover,
.lk-device-menu select:hover {
  border-color: rgba(255, 255, 255, 0.15) !important;
}
.lk-prejoin select option {
  background: #141414 !important;
  color: #ffffff !important;
}

/* Join button — large, confident, green with shadow */
.lk-prejoin .lk-join-button {
  background: #22C55E !important;
  color: #ffffff !important;
  border-radius: 10px !important;
  font-weight: 600 !important;
  font-size: 15px !important;
  padding: 14px 28px !important;
  border: none !important;
  cursor: pointer !important;
  min-height: 48px !important;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.25), 0 1px 2px rgba(0, 0, 0, 0.15) !important;
  transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease !important;
  letter-spacing: 0.01em !important;
}
.lk-prejoin .lk-join-button:hover {
  background: #16A34A !important;
  box-shadow: 0 4px 16px rgba(34, 197, 94, 0.35), 0 2px 4px rgba(0, 0, 0, 0.2) !important;
}
.lk-prejoin .lk-join-button:active {
  background: #15803D !important;
  transform: scale(0.98) !important;
  box-shadow: 0 1px 4px rgba(34, 197, 94, 0.2) !important;
}
.lk-prejoin .lk-join-button:disabled {
  background: #1C1C1E !important;
  color: #6B7280 !important;
  cursor: not-allowed !important;
  box-shadow: none !important;
  transform: none !important;
}

/* Button group container — device toggle row */
.lk-prejoin .lk-button-group-container {
  gap: 12px !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * VIDEO CONFERENCE — Main session layout
 * ═══════════════════════════════════════════════════════════════════════════ */
.lk-video-conference {
  background: #0a0a0c !important;
  height: 100% !important;
}
.lk-video-conference-inner {
  flex: 1 !important;
}

/* Grid/focus layout wrappers */
.lk-grid-layout-wrapper,
.lk-focus-layout-wrapper {
  background: #0a0a0c !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CHAT SIDEBAR — Clean messages, proper bubbles, refined scrollbar
 * ═══════════════════════════════════════════════════════════════════════════ */
.lk-chat {
  background: #0f0f11 !important;
  border-left: 1px solid rgba(255, 255, 255, 0.06) !important;
  max-width: 320px !important;
}

/* Chat header */
.lk-chat-header {
  background: #0f0f11 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
  font-weight: 600 !important;
  color: #ffffff !important;
}
.lk-chat-header .lk-close-button {
  color: #9CA3AF !important;
  border-radius: 8px !important;
  min-width: 36px !important;
  min-height: 36px !important;
  transition: background 0.2s ease, color 0.2s ease !important;
}
.lk-chat-header .lk-close-button:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  color: #ffffff !important;
}

/* Chat messages list — thin dark scrollbar */
.lk-chat-messages {
  padding: 4px 0 !important;
  gap: 2px !important;
}
.lk-chat-messages::-webkit-scrollbar {
  width: 4px !important;
}
.lk-chat-messages::-webkit-scrollbar-track {
  background: transparent !important;
}
.lk-chat-messages::-webkit-scrollbar-thumb {
  background: #2C2C2E !important;
  border-radius: 2px !important;
}
.lk-chat-messages::-webkit-scrollbar-thumb:hover {
  background: #3C3C3E !important;
}

/* Chat entries */
.lk-chat-entry {
  background: transparent !important;
  border: none !important;
  padding: 4px 12px !important;
  margin: 0 4px !important;
}

/* Message meta (sender name + timestamp) */
.lk-chat-entry .lk-meta-data {
  font-size: 11px !important;
  color: #6B7280 !important;
  padding: 0 4px !important;
}
.lk-chat-entry .lk-meta-data .lk-participant-name {
  color: #9CA3AF !important;
  font-weight: 600 !important;
  margin-top: 8px !important;
}
.lk-chat-entry .lk-meta-data .lk-timestamp {
  color: #4B5563 !important;
  font-size: 10px !important;
}

/* Message bubbles — local vs remote differentiation */
.lk-chat-entry .lk-message-body {
  color: #D4D4D8 !important;
  font-size: 14px !important;
  line-height: 1.45 !important;
  padding: 8px 14px !important;
  border-radius: 16px !important;
}
.lk-chat-entry[data-lk-message-origin="local"] .lk-message-body {
  background: rgba(59, 130, 246, 0.12) !important;
  border-bottom-right-radius: 4px !important;
  color: #f2f2f2 !important;
}
.lk-chat-entry[data-lk-message-origin="remote"] .lk-message-body {
  background: #1C1C1E !important;
  border-bottom-left-radius: 4px !important;
}

/* Chat form input */
.lk-chat-form {
  background: #0f0f11 !important;
  border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
  padding: 10px 12px !important;
  gap: 8px !important;
}
.lk-chat-form-input {
  background: #141414 !important;
  border: 1px solid #2C2C2E !important;
  border-radius: 8px !important;
  color: #ffffff !important;
  padding: 10px 14px !important;
  font-size: 14px !important;
  transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
}
.lk-chat-form-input::placeholder {
  color: #6B7280 !important;
}
.lk-chat-form-input:focus {
  border-color: rgba(59, 130, 246, 0.5) !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
  outline: none !important;
}

/* Chat form send button */
.lk-chat-form .lk-button {
  background: #3B82F6 !important;
  color: #ffffff !important;
  border-radius: 8px !important;
  min-width: 44px !important;
  min-height: 44px !important;
  padding: 8px 12px !important;
  border: none !important;
  transition: background 0.2s ease !important;
}
.lk-chat-form .lk-button:hover {
  background: #2563EB !important;
}
.lk-chat-form .lk-button:disabled {
  background: #1C1C1E !important;
  color: #4B5563 !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TOAST NOTIFICATIONS — Consistent dark styling
 * ═══════════════════════════════════════════════════════════════════════════ */
.lk-toast {
  background: #141414 !important;
  border: 1px solid #2C2C2E !important;
  border-radius: 10px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  color: #D4D4D8 !important;
  padding: 12px 20px !important;
  font-size: 14px !important;
  animation: aspire-lk-fadeIn 0.3s ease-out !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SETTINGS MODAL — Premium overlay panel
 * ═══════════════════════════════════════════════════════════════════════════ */
.lk-settings-menu-modal {
  background: #141414 !important;
  border: 1px solid #2C2C2E !important;
  border-radius: 16px !important;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04) !important;
  color: #ffffff !important;
  animation: aspire-lk-fadeIn 0.25s ease-out !important;
}
.lk-settings-menu-modal::-webkit-scrollbar {
  width: 4px !important;
}
.lk-settings-menu-modal::-webkit-scrollbar-track {
  background: transparent !important;
}
.lk-settings-menu-modal::-webkit-scrollbar-thumb {
  background: #2C2C2E !important;
  border-radius: 2px !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SPINNER — Theme-colored loading indicator
 * ═══════════════════════════════════════════════════════════════════════════ */
.lk-spinner {
  color: #3B82F6 !important;
}

/* Start audio button — prominent CTA */
.lk-start-audio-button {
  background: #3B82F6 !important;
  color: #ffffff !important;
  border-radius: 10px !important;
  padding: 14px 24px !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3) !important;
  transition: background 0.2s ease, box-shadow 0.2s ease !important;
}
.lk-start-audio-button:hover {
  background: #2563EB !important;
  box-shadow: 0 6px 24px rgba(59, 130, 246, 0.4) !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * GUEST BADGE + BRANDING OVERLAYS
 * ═══════════════════════════════════════════════════════════════════════════ */
.guest-badge-overlay {
  transition: opacity 0.3s ease !important;
}
.guest-badge-overlay:hover {
  opacity: 0.7 !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * GLOBAL SCROLLBAR REFINEMENT — Applies inside LiveKit theme
 * ═══════════════════════════════════════════════════════════════════════════ */
[data-lk-theme="default"] ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
[data-lk-theme="default"] ::-webkit-scrollbar-track {
  background: transparent;
}
[data-lk-theme="default"] ::-webkit-scrollbar-thumb {
  background: #2C2C2E;
  border-radius: 3px;
}
[data-lk-theme="default"] ::-webkit-scrollbar-thumb:hover {
  background: #3C3C3E;
}

/* Firefox scrollbar */
[data-lk-theme="default"] * {
  scrollbar-width: thin;
  scrollbar-color: #2C2C2E transparent;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RESPONSIVE — Tablet (768px)
 * ═══════════════════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .lk-grid-layout {
    gap: 3px !important;
    padding: 3px !important;
  }
  .lk-control-bar {
    padding: 8px 12px !important;
    gap: 4px !important;
  }
  .lk-control-bar .lk-button,
  .lk-control-bar .lk-chat-toggle,
  .lk-control-bar .lk-disconnect-button {
    min-width: 40px !important;
    min-height: 40px !important;
    padding: 6px 10px !important;
  }
  .lk-participant-name {
    font-size: 11px !important;
  }
  .lk-chat {
    max-width: 260px !important;
  }
  .lk-prejoin {
    max-width: 100% !important;
    padding: 16px !important;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RESPONSIVE — Small Tablet / Large Phone (600px — LiveKit internal breakpoint)
 * ═══════════════════════════════════════════════════════════════════════════ */
@media (max-width: 600px) {
  .lk-focus-layout {
    gap: 2px !important;
  }
  .lk-chat {
    background: rgba(10, 10, 12, 0.95) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RESPONSIVE — Phone (480px)
 * ═══════════════════════════════════════════════════════════════════════════ */
@media (max-width: 480px) {
  .lk-grid-layout {
    gap: 2px !important;
    padding: 2px !important;
  }
  .lk-control-bar {
    padding: 6px 8px !important;
    gap: 3px !important;
  }
  .lk-control-bar .lk-button,
  .lk-control-bar .lk-chat-toggle {
    min-width: 38px !important;
    min-height: 38px !important;
    padding: 6px 8px !important;
    font-size: 0 !important; /* Hide text labels, show icons only */
  }
  .lk-control-bar .lk-button svg,
  .lk-control-bar .lk-chat-toggle svg {
    width: 20px !important;
    height: 20px !important;
  }
  .lk-disconnect-button {
    font-size: 0 !important;
    min-width: 38px !important;
    padding: 6px 10px !important;
  }
  .lk-disconnect-button svg {
    width: 20px !important;
    height: 20px !important;
  }
  .lk-chat {
    max-width: 100% !important;
    position: fixed !important;
    inset: 0 !important;
    bottom: 0 !important;
    z-index: 20 !important;
    border-left: none !important;
    background: rgba(10, 10, 12, 0.97) !important;
    backdrop-filter: blur(20px) !important;
    -webkit-backdrop-filter: blur(20px) !important;
  }
  .lk-prejoin {
    padding: 12px !important;
  }
  .lk-prejoin .lk-video-container {
    max-height: 200px !important;
  }
  .lk-prejoin .lk-join-button {
    padding: 12px 20px !important;
    font-size: 14px !important;
  }
  .lk-participant-name {
    font-size: 10px !important;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * REDUCED MOTION — Respect user preferences
 * ═══════════════════════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  .lk-participant-tile[data-lk-speaking="true"]:not([data-lk-source="screen_share"]) {
    animation: none !important;
    box-shadow: 0 0 0 2px rgba(52, 199, 89, 0.6), 0 0 12px rgba(52, 199, 89, 0.2) !important;
  }
  .lk-prejoin {
    animation: none !important;
  }
  .lk-toast {
    animation: none !important;
  }
  .lk-settings-menu-modal {
    animation: none !important;
  }
  .lk-control-bar .lk-button,
  .lk-control-bar .lk-chat-toggle,
  .lk-disconnect-button,
  .lk-prejoin .lk-join-button {
    transition: none !important;
  }
}
`;

let injected = false;

/**
 * Inject LiveKit CSS into the document head.
 * Safe to call multiple times — only injects once.
 *
 * Injection order:
 * 1. Base structural CSS (layout, sizing, positioning from @livekit/components-styles)
 * 2. Aspire dark theme overrides (colors, borders — !important rules take precedence)
 */
export function injectLiveKitStyles(): void {
  if (Platform.OS !== 'web' || injected) return;
  if (typeof document === 'undefined') return;

  // Check if already injected (e.g., hot reload)
  if (document.getElementById(LIVEKIT_STYLE_ID)) {
    injected = true;
    return;
  }

  // Step 1: Inject base LiveKit structural CSS (layout for prefab components)
  if (!document.getElementById(LIVEKIT_BASE_STYLE_ID)) {
    const baseStyle = document.createElement('style');
    baseStyle.id = LIVEKIT_BASE_STYLE_ID;
    baseStyle.textContent = LIVEKIT_BASE_CSS;
    document.head.appendChild(baseStyle);
  }

  // Step 2: Inject Aspire dark theme overrides (loaded second — !important wins)
  const style = document.createElement('style');
  style.id = LIVEKIT_STYLE_ID;
  style.textContent = LIVEKIT_ASPIRE_CSS;
  document.head.appendChild(style);
  injected = true;
}
