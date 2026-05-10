// Anam Ava iframe HTML builder. Used by both client (srcDoc) and server
// (GET /api/anam/iframe-page route). Returns a complete HTML document
// with the Anam SDK bootstrap inline. The SDK is loaded same-origin from
// /vendor/anam/4.12.0/index.js (built by scripts/build-anam-sdk.mjs).

/* eslint-disable */
export
function buildAvaVideoFrameDoc(sessionToken: string, profile: any, suiteId?: string, toolSecret?: string) {
  const encodedSessionToken = JSON.stringify(sessionToken);
  const encodedProfile = JSON.stringify(profile);
  // suiteId and toolSecret are injected as JS constants, NOT URL params, so
  // they never appear in browser history, server access logs, or network HAR
  // captures. The iframe is same-origin only (X-Frame-Options: SAMEORIGIN).
  // Law #9: toolSecret is redacted from all receipts/logs — only used here to
  // authenticate the pending-cards poll from within the iframe.
  const encodedSuiteId = JSON.stringify(suiteId || '');
  const encodedToolSecret = JSON.stringify(toolSecret || '');
  
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
      // suiteId and toolSecret are injected at render time by the server-side
      // GET /api/anam/iframe-page route. Never in URL params — Law #9.
      const _suiteId = ${encodedSuiteId};
      const _toolSecret = ${encodedToolSecret};
      const statusEl = document.getElementById('status');
      const hintEl = document.getElementById('resume-hint');
      const post = (payload) => window.parent.postMessage({ source: 'ava-anam-frame', ...payload }, '*');
      // ── show_cards dedupe map (Wave 3) ──────────────────────────────────────
      // Prevents double-render when both the brain AND the server auto-emit
      // fire within the 3s dedupe window. Key: _card_cache_id, value: timestamp.
      // Evict at 30s so memory doesn't leak across a full session.
      var _showCardsSeen = new Map();
      var SHOW_CARDS_DEDUPE_MS = 3000;
      var SHOW_CARDS_EVICT_MS = 30000;
      function _evictShowCardsSeen() {
        var now = Date.now();
        for (var _sce of _showCardsSeen.entries()) {
          if (now - _sce[1] > SHOW_CARDS_EVICT_MS) _showCardsSeen.delete(_sce[0]);
        }
      }
      // Returns true if this cacheId was seen within the dedupe window (duplicate).
      function _isDuplicateShowCards(cacheId, source) {
        _evictShowCardsSeen();
        if (!cacheId) {
          // M-3: telemetry for missing cacheId — if non-zero in production the
          // upstream invoke_adam response is dropping _card_cache_id. The render
          // is still allowed (return false) but we want visibility.
          post({ type: 'show_cards_no_cache_id', payload: { source: source } });
          return false;
        }
        if (_showCardsSeen.has(cacheId)) {
          var firstSeen = _showCardsSeen.get(cacheId);
          if (Date.now() - firstSeen < SHOW_CARDS_DEDUPE_MS) {
            post({ type: 'show_cards_deduped', payload: { cacheId: cacheId, source: source } });
            return true;
          }
        }
        _showCardsSeen.set(cacheId, Date.now());
        return false;
      }
      // Polls GET /api/agent-tools/pending-cards after invoke_adam completes.
      // If the brain already emitted show_cards, _isDuplicateShowCards guards.
      // Auth: x-aspire-tool-secret injected by server at iframe render time.
      async function _pollPendingCards() {
        if (!_suiteId) return;
        try {
          var resp = await fetch(
            '/api/agent-tools/pending-cards?suite_id=' + encodeURIComponent(_suiteId),
            {
              method: 'GET',
              headers: _toolSecret ? { 'x-aspire-tool-secret': _toolSecret } : {},
            },
          );
          if (!resp.ok || resp.status === 204) return; // 204 = no pending card
          var data = await resp.json();
          if (!data || !Array.isArray(data.records) || data.records.length === 0) return;
          var cacheId = data._card_cache_id || '';
          if (_isDuplicateShowCards(cacheId, 'server')) return; // brain already rendered
          post({
            type: 'show_cards',
            payload: {
              artifact_type: data.artifact_type || '',
              records: data.records,
              summary: data.summary || '',
              _card_cache_id: cacheId,
              source: 'server',
            },
          });
        } catch (e) {
          // Best-effort — never block session on polling failure.
          console.warn('[AvaIframe] pending-cards poll error', e);
        }
      }
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
            voiceDetection: { endOfSpeechSensitivity: 0.4 },
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
                // Dedupe: if the server auto-emit already fired this cacheId
                // within the 3s window, skip the brain-emitted duplicate.
                var _cacheId = args._card_cache_id || args.card_cache_id || '';
                if (!_isDuplicateShowCards(_cacheId, 'brain')) {
                  post({ type: 'show_cards', payload: { ...args, source: 'brain' } });
                }
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
          // Any TS-only syntax (type annotations, \`as\` casts, generics) will
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
          // 2026-05-06: tool-error recovery pool. Production transcript
          // 51eb43c3 showed a 34-second silence after invoke_adam returned
          // an error — the brain failed the prompt's 5-second voice rule.
          // This pool fires deterministically 1.5s after TOOL_CALL_FAILED
          // unless the brain spoke in the last 1500ms (suppression window
          // matches the preamble pattern). Keys are tool names; falls back
          // to the generic line.
          var TOOL_ERROR_RECOVERY_POOL = {
            invoke_adam: [
              "Hmm, that didn't pull anything. Want me to try without the apartment number?",
              "Didn't come back with results. Try again with a simpler address?",
              "Got an empty result. Different address or different angle?"
            ],
            invoke_quinn: [
              "That didn't go through. Want me to retry?",
              "Hit a snag on that one. Try again?"
            ],
            invoke_tec: [
              "Document didn't come through. Want to retry?"
            ],
            invoke_clara: [
              "Didn't get a response on that. Try again?"
            ],
            generic: [
              "Got an error on that. Want me to retry?",
              "That didn't come through. One more try?"
            ]
          };
          var errorRecoveryIdxRefs = {
            invoke_adam: { idx: -1 },
            invoke_quinn: { idx: -1 },
            invoke_tec: { idx: -1 },
            invoke_clara: { idx: -1 },
            generic: { idx: -1 }
          };
          // 2026-05-09: post-success hold pool. Production transcript 3cdc28d8
          // showed a 32-second silence after invoke_quinn returned SUCCESS —
          // brain took ~32s to compose the post-tool response. Mid-tool fillers
          // had already exhausted (cap 12s). Brain dead-air violated the
          // prompt's P0 5-second voice rule.
          //
          // Fix: schedule a deterministic hold line 4s after TOOL_CALL_COMPLETED
          // for non-fast tools, suppressed if the brain spoke in the last 4500ms.
          // Hold lines are SHORT and FORWARD-LOOKING — they buy time without
          // committing to a result the brain hasn't computed yet. Distinct from
          // the error pool (which proposes remediation).
          //
          // Skipped for: show_cards (instant), end_session (terminal),
          // ava_get_context (background, no user-visible action).
          var TOOL_SUCCESS_HOLD_POOL = {
            invoke_adam: [
              "Almost there — pulling it up.",
              "Got the data — one sec to read it.",
              "Just a moment, formatting that for you."
            ],
            invoke_quinn: [
              "Almost ready — one sec.",
              "Got it back — give me a moment.",
              "Pulled what I need — one second."
            ],
            invoke_tec: [
              "Got it — preparing the document.",
              "Almost done — one sec."
            ],
            invoke_clara: [
              "Got the legal data — one sec.",
              "Almost ready — give me a moment."
            ],
            ava_search: [
              "Found it — one sec.",
              "Got the results — pulling them up."
            ],
            Knowledge_Ava: [
              "Got it — one moment.",
              "Almost there."
            ],
            generic: [
              "Almost ready — one sec.",
              "Got it back — one moment."
            ]
          };
          var successHoldIdxRefs = {
            invoke_adam: { idx: -1 },
            invoke_quinn: { idx: -1 },
            invoke_tec: { idx: -1 },
            invoke_clara: { idx: -1 },
            ava_search: { idx: -1 },
            Knowledge_Ava: { idx: -1 },
            generic: { idx: -1 }
          };
          var SUCCESS_HOLD_SKIP_TOOLS = {
            show_cards: 1,
            end_session: 1,
            ava_get_context: 1,
            ava_request_approval: 1,
          };
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
                var msgType = 'mid_tool_filler';
                if (kind === 'preamble') msgType = 'tool_preamble';
                else if (kind === 'tool_error_recovery') msgType = 'tool_error_recovery';
                else if (kind === 'tool_success_hold') msgType = 'tool_success_hold';
                post({ type: msgType, payload: { text: text, kind: kind } });
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
            var completedToolName = (event && event.toolName) || '';
            post({ type: 'tool_call_completed', payload: { toolName: completedToolName, executionTime: event && event.executionTime } });
            // Wave 3: after invoke_adam completes, poll the server's pending-cards
            // endpoint. If the brain already emitted show_cards, _isDuplicateShowCards
            // guards against a double render. If the brain forgot (the bug), this
            // fires the render deterministically (server-side backstop).
            // Delay 300ms — gives the brain's show_cards CLIENT call time to arrive
            // via CLIENT_TOOL_EVENT_RECEIVED before the poll consumes the pending entry.
            if (completedToolName === 'invoke_adam') {
              setTimeout(_pollPendingCards, 300);
            }
            // 2026-05-09 (W11.1): post-success hold-line. Closes the 32s dead-air
            // gap observed in transcript 3cdc28d8 when invoke_quinn returned
            // SUCCESS but the brain took ~32s to compose its response. The
            // mid-tool fillers (6s, 12s) had already exhausted, so user heard
            // 20s of additional silence after the last filler.
            //
            // Skip for fast/terminal/background tools where a hold line is
            // either superfluous or actively wrong (end_session, show_cards).
            // Suppress if persona spoke in last 4500ms (post-tool brain ack
            // already covers it — no double-talk).
            if (SUCCESS_HOLD_SKIP_TOOLS[completedToolName]) return;
            var tCompleteStart = Date.now();
            setTimeout(function () {
              var nowTs = Date.now();
              var personaSpokeRecently = (lastPersonaSpeechAt >= tCompleteStart - 200) && (lastPersonaSpeechAt <= nowTs);
              if (personaSpokeRecently) {
                post({ type: 'tool_success_hold_skipped', payload: { reason: 'persona_speaking', toolName: completedToolName } });
                return;
              }
              var pool = TOOL_SUCCESS_HOLD_POOL[completedToolName] || TOOL_SUCCESS_HOLD_POOL.generic;
              var idxRef = successHoldIdxRefs[completedToolName] || successHoldIdxRefs.generic;
              speakNarration(pickFromPool(pool, idxRef), 'tool_success_hold');
            }, 4000);
          });
          client.addListener(AnamEvent.TOOL_CALL_FAILED, function (event) {
            clearMidToolTimers();
            var failedToolName = (event && event.toolName) || '';
            post({ type: 'tool_call_failed', payload: { toolName: failedToolName, errorMessage: event && event.errorMessage } });
            // P0 voice rule: speak within 5s of any tool result (success
            // or error). Production transcript 51eb43c3 showed Ava silent
            // for 34 seconds after invoke_adam returned an empty-result
            // error. Fix: schedule a deterministic recovery line at 2.5s
            // post-error, suppressed if the brain already spoke in the
            // last 2500ms (it occasionally recovers on its own).
            //
            // M-2: raised from 1.5s → 2.5s because the brain takes 2-4s to
            // compose a recovery turn when LLM inference is loaded. The 1.5s
            // window caused double-talk: brain + iframe spoke simultaneously.
            var tErrorStart = Date.now();
            setTimeout(function () {
              var nowTs = Date.now();
              // Re-check lastPersonaSpeechAt at speak time (not just at scheduling
              // time) to catch post-error TTS chunks the brain streams back.
              var personaSpokeRecently = (lastPersonaSpeechAt >= tErrorStart - 200) && (lastPersonaSpeechAt <= nowTs);
              if (personaSpokeRecently) {
                post({ type: 'tool_error_recovery_skipped', payload: { reason: 'persona_speaking', toolName: failedToolName } });
                return;
              }
              var pool = TOOL_ERROR_RECOVERY_POOL[failedToolName] || TOOL_ERROR_RECOVERY_POOL.generic;
              var idxRef = errorRecoveryIdxRefs[failedToolName] || errorRecoveryIdxRefs.generic;
              speakNarration(pickFromPool(pool, idxRef), 'tool_error_recovery');
            }, 2500);
          });
          if (AnamEvent.CLIENT_TOOL_EVENT_RECEIVED) {
            client.addListener(AnamEvent.CLIENT_TOOL_EVENT_RECEIVED, (event) => {
              const toolName = event?.eventName || event?.toolName;
              const args = event?.eventData || event?.arguments || {};
              if (toolName === 'show_cards') {
                var _cteId = (args && (args._card_cache_id || args.card_cache_id)) || '';
                if (!_isDuplicateShowCards(_cteId, 'brain')) {
                  post({ type: 'show_cards', payload: { ...args, source: 'brain' } });
                  // P0-3 (Law #2): fire-and-forget receipt for brain-sourced renders.
                  // Without this, the majority of card renders (LLM-compliant sessions)
                  // produce zero receipts. Wrapped in try/catch so a receipt POST
                  // failure NEVER blocks or delays the card render.
                  if (_suiteId) {
                    var _brainRecordCount = Array.isArray(args.records) ? args.records.length : 0;
                    fetch('/api/agent-tools/show-cards-rendered', {
                      method: 'POST',
                      headers: Object.assign(
                        { 'Content-Type': 'application/json' },
                        _toolSecret ? { 'x-aspire-tool-secret': _toolSecret } : {},
                      ),
                      body: JSON.stringify({
                        suite_id: _suiteId,
                        cacheId: _cteId || null,
                        artifact_type: (args && args.artifact_type) || 'unknown',
                        record_count: _brainRecordCount,
                      }),
                    }).catch(function (e) {
                      // Best-effort — receipt POST failure must never interrupt render.
                      console.warn('[AvaIframe] brain-render receipt POST failed', e);
                    });
                  }
                }
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
