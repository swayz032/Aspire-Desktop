// Anam Ava iframe HTML builder. Used by both client (srcDoc) and server
// (GET /api/anam/iframe-page route). Returns a complete HTML document
// with the Anam SDK bootstrap inline. The SDK is loaded same-origin from
// /vendor/anam/4.12.0/index.js (built by scripts/build-anam-sdk.mjs).

/* eslint-disable */
export 
function buildAvaVideoFrameDoc(sessionToken: string, profile: any) {
  const encodedSessionToken = JSON.stringify(sessionToken);
  const encodedProfile = JSON.stringify(profile);
  
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at top, #111827 0%, #020617 45%, #000 100%);
        overflow: hidden;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        font-family: Arial, sans-serif;
        cursor: pointer;
      }
      #anam-video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        object-position: center top;
        background: transparent;
      }
      #status {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        font-size: 14px;
        gap: 16px;
        background: radial-gradient(circle at top, #111827 0%, #020617 45%, #000 100%);
        z-index: 10;
      }
      .spinner {
        width: 36px;
        height: 36px;
        border: 3px solid rgba(59,130,246,0.15);
        border-top-color: #3B82F6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      
      #resume-hint {
        position: absolute;
        bottom: 20px;
        background: rgba(0,0,0,0.6);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s;
        border: 1px solid rgba(255,255,255,0.2);
        z-index: 20;
      }
    </style>
  </head>
  <body>
    <video id="anam-video" autoplay playsinline></video>
    <div id="status"><div class="spinner"></div><div id="status-text">Connecting to Ava...</div></div>
    <div id="resume-hint">Tap anywhere to hear Ava</div>
    
    <script>
      // Classic <script> (was type="module"). The script only uses dynamic
      // import() (not static "import x from"), which works in both contexts.
      // Classic scripts have less strict loading policies under COEP
      // credentialless and srcDoc iframes than module scripts do.
      // Liveness beacon — fires synchronously the moment the script begins
      // executing, BEFORE any imports or async work. If the parent's outer
      // 40s timeout fires without ever receiving 'iframe_alive', the
      // iframe's JavaScript never ran (CSP block, COEP isolation, sandbox
      // attribute, srcDoc parse failure). This eliminates a major
      // visibility gap that previously surfaced as a silent 40s hang.
      try { window.parent.postMessage({ source: 'ava-anam-frame', type: 'iframe_alive', ts: Date.now() }, '*'); } catch (e) { /* parent may be cross-origin in some contexts */ }
      // Top-level error hook — anything thrown synchronously during module
      // parse/eval that escapes start()'s try/catch (e.g., a syntax error
      // in a downstream import, or a CSP violation on the dynamic import)
      // is captured here and forwarded to the parent so the UI can show
      // the real reason instead of the generic 40s timeout.
      window.addEventListener('error', (ev) => {
        try { window.parent.postMessage({ source: 'ava-anam-frame', type: 'error', stage: 'window_error', message: (ev?.error?.message || ev?.message || 'window error') + (ev?.filename ? ' @ ' + ev.filename : '') }, '*'); } catch (e) {}
      });
      window.addEventListener('unhandledrejection', (ev) => {
        try { window.parent.postMessage({ source: 'ava-anam-frame', type: 'error', stage: 'unhandled_rejection', message: (ev?.reason?.message || String(ev?.reason || 'unhandled rejection')) }, '*'); } catch (e) {}
      });
      const sessionToken = ${encodedSessionToken};
      const profile = ${encodedProfile};
      const statusEl = document.getElementById('status');
      const hintEl = document.getElementById('resume-hint');
      const post = (payload) => window.parent.postMessage({ source: 'ava-anam-frame', ...payload }, '*');
      const statusTextEl = document.getElementById('status-text');
      const setStatus = (message) => {
        if (statusTextEl) statusTextEl.textContent = message;
      };

      let client = null;

      const playAudio = async () => {
        const vid = document.getElementById('anam-video');
        if (vid) {
          try {
            await vid.play();
            if (hintEl) hintEl.style.opacity = '0';
          } catch (e) {
            console.warn('Manual audio play failed', e);
          }
        }
      };
      
      document.body.addEventListener('click', playAudio);
      document.body.addEventListener('mousedown', playAudio);
      document.body.addEventListener('touchstart', playAudio);

      const start = async () => {
        try {
          // Pin the Anam SDK version. Previously was @latest which is a
          // moving target — if Anam ships a breaking change the iframe
          // silently hangs on streamToVideoElement with no console error.
          //
          // Pinned to 4.12.0 (published 2026-03-18) — the last stable
          // version before 4.13.0 (2026-04-13) which appears to have
          // introduced the connection hang we're debugging. Bump this
          // version intentionally after testing.
          console.log('[AvaIframe] start: importing Anam SDK 4.12.0 (self-hosted)…');
          // Self-hosted same-origin bundle — built by scripts/build-anam-sdk.mjs,
          // served by Express from public/vendor/anam/<version>/index.js with
          // immutable caching. Removes esm.sh as a SPOF and tightens CSP.
          // Version is path-pinned so cache invalidates atomically on bump.
          const sdkImportTimeout = new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error('SDK_IMPORT_TIMEOUT')); }, 10000);
          });
          const sdk = await Promise.race([
            import('/vendor/anam/4.12.0/index.js'),
            sdkImportTimeout,
          ]);
          // The bundle re-exports AnamEvent and ConnectionClosedCode from the
          // same module — no separate /types import needed (one fewer request,
          // one fewer hang point).
          const types = sdk;
          console.log('[AvaIframe] SDK loaded, sessionToken length:', (sessionToken || '').length);
          // Aligned with Anam docs: createClient(sessionToken, options).
          // voiceDetection here is the client-side override — server-side
          // voiceDetectionOptions on the persona is the source of truth, but
          // passing it here protects against a stale persona definition.
          var clientOptions = {
            sessionOptions: { videoQuality: 'high' },
            voiceDetection: { endOfSpeechSensitivity: 0.7 },
          };
          try {
            client = sdk.createClient(sessionToken, clientOptions);
            console.log('[AvaIframe] client created with sessionOptions');
          } catch (e) {
            console.warn('[AvaIframe] createClient with sessionOptions failed, falling back to single-arg', e);
            client = sdk.createClient(sessionToken);
            console.log('[AvaIframe] client created without sessionOptions');
          }
          const AnamEvent = types.AnamEvent;
          console.log('[AvaIframe] AnamEvent enum loaded, keys:', AnamEvent ? Object.keys(AnamEvent).length : 0);

          if (typeof client.registerToolCallHandler === 'function') {
            client.registerToolCallHandler('show_cards', {
              onStart: async (payload) => {
                const args = payload?.arguments || {};
                post({ type: 'show_cards', payload: args });
                return 'Cards displayed.';
              },
            });
            // Voice-driven session end. Ava calls this when the user signals
            // goodbye/hang up/end. The handler:
            //   1. Notifies the parent immediately so UI state can flip.
            //   2. Returns a confirmation string the LLM can lead with.
            //   3. After a brief grace period (1.8s — enough for Anam's
            //      sign-off TTS to render), tears down the WebRTC stream
            //      via stopStreaming(). The parent's CONNECTION_CLOSED
            //      handler will also fire, so handleEndSession is idempotent.
            client.registerToolCallHandler('end_session', {
              onStart: async () => {
                post({ type: 'end_session_requested', payload: { reason: 'user_voice' } });
                setTimeout(() => {
                  try { client?.stopStreaming?.(); } catch (e) { /* already torn down */ }
                }, 1800);
                return 'Session ending. Goodbye.';
              },
            });
          }

          // ── Tool-call narration: preamble + mid-tool fillers ───────────────
          // Anam's LLM is non-deterministic about pre-tool acknowledgment even
          // with a prompt rule — transcripts cc159970 (7:50:12) and 1e1cfe29
          // (7:52:22) showed the model firing invoke_adam with zero spoken text,
          // leaving the user staring at a silent avatar (a perceived hang).
          //
          // Fix: deterministic client-side narration scheduled on the SDK's
          // TOOL_CALL_STARTED event, routed through client.talk() so audio
          // synthesizes through Ava's voice + lip-sync without polluting
          // conversation history.
          //
          //   t = 0.4s  → preamble  ("Alright, let me take care of that.")
          //               — SUPPRESSED if the LLM is already speaking (the
          //                 prompt's natural preamble fired). Detected via
          //                 MESSAGE_STREAM_EVENT_RECEIVED with role=persona
          //                 within ~600ms of TOOL_CALL_STARTED. No double-talk.
          //   t = 6s    → first mid-filler  ("Just one more sec, almost there.")
          //   t = 12s   → second mid-filler ("Still digging — hang tight.")
          //
          // All timers are CANCELED on TOOL_CALL_COMPLETED or TOOL_CALL_FAILED.
          // show_cards is excluded — it's a frontend display tool with no
          // measurable wait. Pools rotate so consecutive tool calls don't echo
          // the same line.
          // CRITICAL: this entire script runs as plain JavaScript inside an
          // HTML <script type="module"> tag — it is NOT compiled by TypeScript.
          // Any TS-only syntax (type annotations, `as` casts, generics) will
          // throw "Unexpected token" at parse time and brick the spinner.
          // Keep this block in pure JS.
          var midToolTimers = [];
          var lastPersonaSpeechAt = 0;
          var FILLER_FAST_TOOLS = { 'show_cards': 1 };
          var PREAMBLE_POOL = [
            "Alright, let me take care of that.",
            "On it — one moment.",
            "Pulling that up now.",
            "Let me check that for you."
          ];
          var FILLER_POOL_FIRST = [
            "Just one more sec, almost there.",
            "Hang on, pulling that up.",
            "One moment, still on it.",
            "Almost done."
          ];
          var FILLER_POOL_SECOND = [
            "Still digging — hang tight.",
            "Just another sec, close now.",
            "Pulling it together, almost there."
          ];
          function pickFromPool(pool, lastIdxRef) {
            if (!pool.length) return null;
            var idx = Math.floor(Math.random() * pool.length);
            if (pool.length > 1 && idx === lastIdxRef.idx) {
              idx = (idx + 1) % pool.length;
            }
            lastIdxRef.idx = idx;
            return pool[idx];
          }
          var preambleIdxRef = { idx: -1 };
          var firstFillerIdxRef = { idx: -1 };
          var secondFillerIdxRef = { idx: -1 };
          function clearMidToolTimers() {
            for (var i = 0; i < midToolTimers.length; i++) {
              try { clearTimeout(midToolTimers[i]); } catch (e) { /* noop */ }
            }
            midToolTimers = [];
          }
          function speakNarration(text, kind) {
            if (!text) return;
            try {
              if (typeof client.talk === 'function') {
                client.talk(text);
                post({ type: kind === 'preamble' ? 'tool_preamble' : 'mid_tool_filler', payload: { text: text, kind: kind } });
              }
            } catch (e) {
              // SDK or session closed — swallow; no observable side-effect.
            }
          }
          // Track persona speech so we can suppress the client preamble when
          // the LLM is already covering the acknowledgment. We only update on
          // non-empty persona content — empty events are stream keepalives.
          if (AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED) {
            client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, function (msg) {
              try {
                var role = msg && msg.role;
                var content = msg && msg.content;
                if (role === 'persona' && typeof content === 'string' && content.trim().length > 0) {
                  lastPersonaSpeechAt = Date.now();
                }
              } catch (e) { /* noop */ }
            });
          }

          client.addListener(AnamEvent.TOOL_CALL_STARTED, function (event) {
            var toolName = (event && event.toolName) || '';
            post({ type: 'tool_call_started', payload: { toolName: toolName, arguments: event && event.arguments } });
            // Reset any prior tool-call timers (defensive — back-to-back tools
            // in one turn would otherwise leak).
            clearMidToolTimers();
            // Skip fast/display tools — only research tools wait on the network.
            if (FILLER_FAST_TOOLS[toolName]) return;
            var tStart = Date.now();
            // Preamble fires at 400ms unless the LLM is already speaking.
            // Suppression window: persona spoke within 600ms before TOOL_CALL_STARTED
            // OR speaks during the 400ms wait. That covers both the "LLM emits
            // contextual preamble then tool" pattern and the "LLM speaks
            // simultaneously" pattern. No double-acknowledgment.
            var tPreamble = setTimeout(function () {
              var now = Date.now();
              var personaSpokeRecently = (lastPersonaSpeechAt >= tStart - 600) && (lastPersonaSpeechAt <= now);
              if (personaSpokeRecently) {
                post({ type: 'tool_preamble_skipped', payload: { reason: 'persona_speaking', toolName: toolName } });
                return;
              }
              speakNarration(pickFromPool(PREAMBLE_POOL, preambleIdxRef), 'preamble');
            }, 400);
            var t1 = setTimeout(function () { speakNarration(pickFromPool(FILLER_POOL_FIRST, firstFillerIdxRef), 'mid_first'); }, 6000);
            var t2 = setTimeout(function () { speakNarration(pickFromPool(FILLER_POOL_SECOND, secondFillerIdxRef), 'mid_second'); }, 12000);
            midToolTimers = [tPreamble, t1, t2];
          });
          client.addListener(AnamEvent.TOOL_CALL_COMPLETED, function (event) {
            clearMidToolTimers();
            post({ type: 'tool_call_completed', payload: { toolName: event && event.toolName, executionTime: event && event.executionTime } });
          });
          client.addListener(AnamEvent.TOOL_CALL_FAILED, function (event) {
            clearMidToolTimers();
            post({ type: 'tool_call_failed', payload: { toolName: event && event.toolName, errorMessage: event && event.errorMessage } });
          });
          if (AnamEvent.CLIENT_TOOL_EVENT_RECEIVED) {
            client.addListener(AnamEvent.CLIENT_TOOL_EVENT_RECEIVED, (event) => {
              const toolName = event?.eventName || event?.toolName;
              const args = event?.eventData || event?.arguments || {};
              if (toolName === 'show_cards') {
                post({ type: 'show_cards', payload: args });
              }
            });
          }

          client.addListener(AnamEvent.SESSION_READY, () => {
            console.log('[AvaIframe] SESSION_READY fired');
            if (statusEl) statusEl.remove();
            post({ type: 'connected' });
            
            // Check if audio is likely blocked after a short delay
            setTimeout(() => {
               const vid = document.getElementById('anam-video');
               if (vid && vid.paused && hintEl) {
                 hintEl.style.opacity = '1';
               }
            }, 1000);

            // 2026 SDK OFFICIAL PATTERN: addContext and triggerGreeting
            if (profile) {
              const now = new Date();
              const fullDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
              const timeOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening';
              
              const context = {
                salutation: profile.salutation || '',
                lastName: profile.lastName || '',
                firstName: profile.firstName || '',
                businessName: profile.businessName || '',
                industry: profile.industry || '',
                gender: profile.gender || '',
                hasCamera: !!profile.hasCamera,
                currentDate: fullDate,
                timeOfDay: timeOfDay
              };

              // Inject context into the persona brain
              if (typeof client.addContext === 'function') {
                client.addContext(context);
              }

              // Explicitly trigger the greeting sequence
              if (typeof client.triggerGreeting === 'function') {
                client.triggerGreeting();
              } else if (typeof client.talk === 'function') {
                // Fallback for older/middle versions of SDK
                const greeting = "Good " + timeOfDay + ", " + (profile.salutation || "") + " " + (profile.lastName || "") + ".";
                client.talk(greeting);
              } else {
                // Ultra-fallback: send as user message to prime
                const primeMsg = "Note to AI: The user is " + (profile.salutation || "") + " " + (profile.lastName || "") + ". Business: " + (profile.businessName || "") + ". Date: " + fullDate + ". Camera: " + (profile.hasCamera ? "true" : "false") + ". Please greet the user now.";
                client.sendUserMessage(primeMsg);
              }
            }
          });

          client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
            console.log('[AvaIframe] CONNECTION_ESTABLISHED fired');
            if (statusEl) statusEl.remove();
            post({ type: 'connected' });
          });

          client.addListener(AnamEvent.AUDIO_STREAM_STARTED, () => {
            console.log('[AvaIframe] AUDIO_STREAM_STARTED fired');
            playAudio();
          });

          client.addListener(AnamEvent.CONNECTION_CLOSED, (code) => {
            console.warn('[AvaIframe] CONNECTION_CLOSED', code);
            clearMidToolTimers();
            // Anam's ConnectionClosedCode is a numeric/string enum. Forward
            // both the raw value and a human label so the parent can render
            // the actual reason (auth failure, ICE failure, server kill, etc.)
            // instead of a generic "Connect failed".
            var closedLabel = '';
            try {
              if (types && types.ConnectionClosedCode) {
                for (var k in types.ConnectionClosedCode) {
                  if (types.ConnectionClosedCode[k] === code) { closedLabel = k; break; }
                }
              }
            } catch (e) { /* noop */ }
            post({ type: 'closed', code: code, codeLabel: closedLabel });
          });

          console.log('[AvaIframe] all listeners registered, calling streamToVideoElement…');
          // Inner timeout: if Anam never reaches SESSION_READY/CONNECTION_ESTABLISHED
          // and streamToVideoElement neither resolves nor throws, kill it at 25s
          // (parent has a 40s outer timer — inner fires first with a real error).
          var streamTimeoutId = null;
          var streamTimeoutPromise = new Promise(function (_, reject) {
            streamTimeoutId = setTimeout(function () {
              reject(new Error('STREAM_TIMEOUT: streamToVideoElement did not resolve within 25s — likely WebRTC ICE failure, mic permission denied, or Anam media-server unreachable. Check connect-eu.anam.ai / connect-us.anam.ai reachability and TURN whitelist.'));
            }, 25000);
          });
          try {
            await Promise.race([
              client.streamToVideoElement('anam-video'),
              streamTimeoutPromise,
            ]);
            console.log('[AvaIframe] streamToVideoElement returned');
          } finally {
            if (streamTimeoutId) clearTimeout(streamTimeoutId);
          }
        } catch (error) {
          console.error('[AvaIframe] bootstrap failed', error);
          var msg = error instanceof Error ? error.message : 'Unable to start Ava video';
          setStatus(msg.length > 80 ? msg.slice(0, 77) + '…' : msg);
          post({
            type: 'error',
            message: msg,
            stage: msg.indexOf('SDK_IMPORT_TIMEOUT') >= 0 ? 'sdk_import'
                 : msg.indexOf('STREAM_TIMEOUT') >= 0 ? 'stream'
                 : 'bootstrap',
          });
        }
      };

      window.addEventListener('beforeunload', () => {
        client?.stopStreaming?.().catch?.(() => {});
      });

      start();
    </script>
  </body>
</html>`;
}
