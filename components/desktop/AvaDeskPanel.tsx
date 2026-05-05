import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { trackInteraction } from '@/lib/interactionTelemetry';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform, Animated, Linking, Alert, Image, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/tokens';
import { ShimmeringText } from '@/components/ui/ShimmeringText';
import { useVoice, type VoiceDiagnosticEvent } from '@/hooks/useVoice';
import { useSupabase, useTenant } from '@/providers';
import {
  type FileAttachment,
  ThinkingIndicator,
  MessagePartRenderer,
} from '@/components/chat';
import { resolvePublicAssetUrl } from '@/lib/publicAssetUrl';
import { playConnectionSound, playSuccessSound } from '@/lib/soundEffects';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { isLocalSyntheticAuthBypass } from '@/lib/supabaseRuntime';
import { useAvaChat } from '@/hooks/useAvaChat';
import { useAvaPresentsContext } from '@/contexts/AvaPresentsContext';
import type { UIMessage } from 'ai';

type AvaMode = 'voice' | 'video';
type VideoConnectionState = 'idle' | 'connecting' | 'connected';

const PROPERTY_ARTIFACT_TYPES = new Set([
  'LandlordPropertyPack',
  'PropertyFactPack',
  'RentCompPack',
  'PermitContextPack',
  'NeighborhoodDemandBrief',
  'ScreeningComplianceBrief',
  'InvestmentOpportunityPack',
]);

function hasStrongPropertySignals(record: any): boolean {
  if (!record || typeof record !== 'object') return false;
  const address = record.normalized_address || record.address;
  const addressOk = typeof address === 'string' && address.trim() !== '' && address.toLowerCase() !== 'unknown address';
  const hasCoreNumeric =
    typeof record.beds === 'number' ||
    typeof record.baths === 'number' ||
    typeof record.living_sqft === 'number' ||
    typeof record.year_built === 'number' ||
    typeof record.tax_market_value === 'number' ||
    typeof record.property_value === 'number';
  return addressOk && hasCoreNumeric;
}

/**
 * Local Camera Preview Component (FaceTime style)
 * Requests camera permission and renders a small local video stream.
 */
function LocalCameraPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
      } catch (err) {
        console.warn('Camera preview permission denied or unavailable', err);
        setHasPermission(false);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.localPreviewContainer}>
      {hasPermission === false ? (
        <View style={styles.localPreviewPlaceholder}>
          <Ionicons name="videocam-off" size={16} color={Colors.text.tertiary} />
        </View>
      ) : (
        <video
          ref={videoRef as any}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 8,
            backgroundColor: '#000',
            transform: [{ scaleX: -1 }] as any, // Mirror effect
          }}
        />
      )}
      <View style={styles.localPreviewOverlay} />
    </View>
  );
}

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
    
    <script type="module">
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


function AvaOrbVideoInline({ size = 320 }: { size?: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const orbSrc = resolvePublicAssetUrl('ava-orb.mp4');

  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        video.ava-orb-video::-webkit-media-controls,
        video.ava-orb-video::-webkit-media-controls-enclosure,
        video.ava-orb-video::-webkit-media-controls-panel,
        video.ava-orb-video::-webkit-media-controls-start-playback-button,
        video.ava-orb-video::-webkit-media-controls-overlay-play-button {
          display: none !important;
          -webkit-appearance: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        video.ava-orb-video::-moz-media-controls { display: none !important; }
        video.ava-orb-video { object-fit: contain; }
      `;
      document.head.appendChild(style);

      const vid = videoRef.current;
      if (vid) {
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.play().catch(() => {});
      }

      return () => { document.head.removeChild(style); };
    }
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <video
        ref={videoRef as any}
        className="ava-orb-video"
        src={orbSrc}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        controls={false}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          background: 'transparent',
        }}
      />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, background: 'transparent' }} />
    </div>
  );
}



function AvaDeskPanelInner() {
  const [mode, setMode] = useState<AvaMode>('voice');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConversing, setIsConversing] = useState(false);
  const [videoState, setVideoState] = useState<VideoConnectionState>('idle');
  const [connectionStatus, setConnectionStatus] = useState('');
  const [anamSessionToken, setAnamSessionToken] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [latestVoiceDiagnostic, setLatestVoiceDiagnostic] = useState<VoiceDiagnosticEvent | null>(null);
  const avaPresents = useAvaPresentsContext();
  const runTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const connectingAnim = useRef(new Animated.Value(0)).current;
  const voiceLineAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const connectionTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dotPulseAnim = useRef(new Animated.Value(1)).current;

  /** Show a voice/video error banner that auto-clears after 5s */
  const showVoiceError = useCallback((msg: string) => {
    setVoiceError(msg);
    setTimeout(() => setVoiceError(null), 5000);
  }, []);

  // Tenant context for voice requests (Law #6: Tenant Isolation)
  const { suiteId, session } = useSupabase();
  const { tenant } = useTenant();
  const [bootstrapIdentity, setBootstrapIdentity] = useState<{
    businessName?: string;
    ownerName?: string;
    suiteDisplayId?: string;
    officeDisplayId?: string;
  } | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('aspire.bootstrap.identity');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setBootstrapIdentity({
        businessName: parsed.businessName || undefined,
        ownerName: parsed.ownerName || undefined,
        suiteDisplayId: parsed.suiteDisplayId || undefined,
        officeDisplayId: parsed.officeDisplayId || undefined,
      });
    } catch {
      // Ignore malformed cache.
    }
  }, []);
  const suiteDisplayId = tenant?.displayId || bootstrapIdentity?.suiteDisplayId || '';
  const officeDisplayId = tenant?.officeDisplayId || bootstrapIdentity?.officeDisplayId || '';
  const resolvedBusinessName = tenant?.businessName || bootstrapIdentity?.businessName || 'Your Company';
  const companyPillLabel = resolvedBusinessName;
  const resolvedOwnerName = tenant?.ownerName || bootstrapIdentity?.ownerName || '';
  
  const avaProfileFallback = useMemo(() => {
    const ownerName = resolvedOwnerName.trim();
    const nameParts = ownerName ? ownerName.split(/\s+/) : [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    
    // Determine salutation based on gender if available
    let salutation = 'Mr.';
    if (tenant?.gender?.toLowerCase() === 'female') salutation = 'Ms.';
    
    return {
      ownerName: ownerName || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      salutation: salutation,
      businessName: resolvedBusinessName || undefined,
      industry: tenant?.industry || undefined,
      gender: tenant?.gender || undefined,
      hasCamera: true,
    };
  }, [resolvedBusinessName, resolvedOwnerName, tenant?.industry, tenant?.gender]);

  const avaVideoFrameDoc = useMemo(
    () => (anamSessionToken ? buildAvaVideoFrameDoc(anamSessionToken, avaProfileFallback) : null),
    [anamSessionToken, avaProfileFallback],
  );

  const [authorityQueue, setAuthorityQueue] = useState<any[]>([]);

  const handleStructuredCards = useCallback((data: { artifact_type: string; records: any[]; summary: string; confidence?: any; card_cache_id?: string; total_count?: number; _records_cached?: boolean; _card_cache_id?: string }) => {
    if (avaPresents.visible) return;
    const artifactType = data.artifact_type;
    const incomingRecords = Array.isArray(data.records) ? data.records : [];
    const likelyProperty = PROPERTY_ARTIFACT_TYPES.has(artifactType);
    const sparseProperty = likelyProperty && !hasStrongPropertySignals(incomingRecords[0]);

    // Server slims invoke_adam responses to display-essential fields and caps
    // at 25 records (see agentToolRoutes.ts records-slim logic). Each slim
    // record has enough fields to render directly. Hydration is only needed
    // if total_count > what we received (i.e., the 25-record cap was hit) AND
    // a suite session is available to authenticate the cache fetch.
    const hasMoreInCache = (
      typeof data.total_count === 'number' && data.total_count > incomingRecords.length
    );

    // MVEO Layer 1 — fire tool-chain integrity beacon. Server cron looks for
    // invoke_adam receipts that returned records with NO matching beacon
    // within 10s, surfaces those as 'show_cards skipped' incidents.
    // Best-effort: failure to beacon must not block card render.
    const fireBeacon = async () => {
      try {
        const beaconCorrelationId = data._card_cache_id || data.card_cache_id || '';
        if (!session?.access_token) return;
        await fetch('/api/telemetry/show-cards-fired', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            invoke_correlation_id: beaconCorrelationId,
            artifact_type: artifactType,
            record_count: typeof data.total_count === 'number' ? data.total_count : incomingRecords.length,
          }),
        });
      } catch {
        // best-effort telemetry, do not surface
      }
    };

    const show = (records: Record<string, unknown>[]) => {
      avaPresents.showCards({
        artifactType,
        records,
        summary: data.summary ?? '',
        confidence: data.confidence as { status: 'verified' | 'partial' | 'unverified'; score: number } | null | undefined,
      });
      void fireBeacon();
    };

    const needsHydration = sparseProperty || hasMoreInCache;

    if (!needsHydration || !suiteId) {
      show(incomingRecords);
      return;
    }

    (async () => {
      try {
        const resp = await fetch(`/api/card-data/latest?suite_id=${encodeURIComponent(suiteId)}`);
        if (resp.ok) {
          const cached = await resp.json();
          if (Array.isArray(cached?.records) && cached.records.length > 0) {
            show(cached.records);
            return;
          }
        }
      } catch {
        // fall through to raw records
      }
      show(incomingRecords);
    })();
  }, [avaPresents, suiteId, session?.access_token]);

  // Ref to break circular dependency: useVoice needs appendLocalMessage, 
  // but appendLocalMessage needs setMessages from useAvaChat, 
  // and useAvaChat usually needs avaVoice from useVoice.
  const appendLocalMessageRef = useRef<(role: 'user' | 'assistant', content: string) => void>(() => {});

  // Orchestrator-routed voice: STT → Orchestrator → TTS (Law #1: Single Brain)
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const videoStateRef = useRef(videoState);
  videoStateRef.current = videoState;

  const avaVoice = useVoice({
    agent: 'ava',
    suiteId: suiteId ?? undefined,
    userId: session?.user?.id,
    accessToken: session?.access_token,
    userProfile: tenant ? {
      ownerName: tenant.ownerName,
      businessName: tenant.businessName,
      industry: tenant.industry ?? undefined,
      teamSize: tenant.teamSize ?? undefined,
      industrySpecialty: tenant.industrySpecialty ?? undefined,
      businessGoals: tenant.businessGoals ?? undefined,
      painPoint: tenant.painPoint ?? undefined,
      preferredChannel: tenant.preferredChannel ?? undefined,
    } : undefined,
    onStatusChange: (voiceStatus) => {
      setIsSessionActive(voiceStatus !== 'idle' && voiceStatus !== 'error');
    },
    onTranscript: (text: string) => {
      // Show user speech in chat panel for visibility
      if (text.trim()) appendLocalMessageRef.current('user', text);
    },
    onResponse: (text: string) => {
      // Show agent response in chat panel
      if (text.trim()) {
        appendLocalMessageRef.current('assistant', text);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    onError: (error) => {
      console.error('Ava voice error:', error);
      setIsSessionActive(false);
      // Classify and surface the error to the user
      const msg = error.message || String(error);
      if (/auth_required/i.test(msg)) {
        showVoiceError('Session expired. Please sign in again.');
      } else if (/circuit_open/i.test(msg)) {
        showVoiceError('Ava Brain is warming back up. Try again in a few seconds.');
      } else if (/orchestrator_timeout|timeout/i.test(msg)) {
        showVoiceError('Ava took too long to respond. Please try again.');
      } else if (/autoplay|not allowed|play\(\)/i.test(msg)) {
        showVoiceError('Tap anywhere on the page, then try again.');
      } else if (/permission|denied|not found.*microphone|getUserMedia/i.test(msg)) {
        showVoiceError('Microphone access denied. Check browser permissions.');
      } else if (/tts|voice.*unavailable|synthesis|elevenlabs/i.test(msg)) {
        showVoiceError('Voice unavailable — responses shown in chat.');
      } else {
        showVoiceError(msg.length > 80 ? msg.slice(0, 80) + '...' : msg);
      }
    },
    onShowCards: handleStructuredCards,
    onDiagnostic: (diag) => {
      setLatestVoiceDiagnostic(diag);
      if (diag.stage === 'autoplay') {
        showVoiceError(`Audio blocked by browser. Tap voice again to retry. Trace: ${diag.traceId}`);
      }
    },
  });

  const avaChatResult = useAvaChat({
    avaVoice, 
    onResponseText: (_text) => {
      // Anam hosted embed handles TTS internally — no SDK talk() needed
    },
    onStructuredResults: handleStructuredCards,
    extraBody: {
      pendingApprovals: authorityQueue.length,
      approvalSummary: authorityQueue.slice(0, 3).map((p: unknown) => (p as Record<string, string>).title || (p as Record<string, string>).type || 'Approval'),
    },
  });

  const { messages, setMessages, sendMessage } = avaChatResult;

  // Append a local message to the chat display (voice transcripts, file uploads, approvals)
  const appendLocalMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev: any[]) => [
      ...prev,
      {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        content,
        parts: [{ type: 'text' as const, text: content }],
        createdAt: new Date(),
      },
    ]);
  }, [setMessages]);

  // Sync the ref
  appendLocalMessageRef.current = appendLocalMessage;

  const handleCompanyPillPress = useCallback(async () => {
    if (latestVoiceDiagnostic?.stage === 'autoplay') {
      const replayed = await avaVoice.replayLastAudio();
      if (replayed) return;
    }
    if (avaVoice.isActive) {
      avaVoice.endSession();
    } else {
      try {
        await avaVoice.startSession();
        await avaVoice.sendText('Confirm voice is live in one short sentence and ask how you can help.', { silent: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Failed to start Ava voice session:', msg);
        if (/auth_required/i.test(msg)) {
          showVoiceError('Session expired. Please sign in again.');
        } else if (/circuit_open/i.test(msg)) {
          showVoiceError('Ava Brain is warming back up. Try again in a few seconds.');
        } else if (/permission|denied|getUserMedia/i.test(msg)) {
          showVoiceError('Microphone access denied. Check browser permissions.');
        } else {
          showVoiceError(`Voice session failed: ${msg.length > 60 ? msg.slice(0, 60) + '...' : msg}`);
        }
      }
    }
  }, [avaVoice, showVoiceError, latestVoiceDiagnostic]);

  useEffect(() => {
    if (isSessionActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSessionActive]);

  useEffect(() => {
    if (videoState === 'connecting') {
      Animated.loop(
        Animated.timing(connectingAnim, { toValue: 1, duration: 1500, useNativeDriver: false })
      ).start();
    } else {
      connectingAnim.setValue(0);
    }
  }, [videoState]);

  // Use refs to avoid stale closures in animation loop callbacks
  const isConversingRef = useRef(isConversing);
  isConversingRef.current = isConversing;

  useEffect(() => {
    if (isConversing) {
      const randomPulse = () => {
        const duration = 150 + Math.random() * 300;
        const toValue = 0.4 + Math.random() * 0.6;
        Animated.sequence([
          Animated.timing(voiceLineAnim, { toValue, duration, useNativeDriver: false }),
          Animated.timing(voiceLineAnim, { toValue: 1, duration: duration * 0.8, useNativeDriver: false }),
        ]).start(() => {
          if (isConversingRef.current) randomPulse();
        });
      };
      randomPulse();
    } else {
      voiceLineAnim.setValue(1);
    }
  }, [isConversing]);

  useEffect(() => {
    return () => {
      connectionTimeouts.current.forEach(clearTimeout);
      connectionTimeouts.current = [];
    };
  }, []);

  const isAvaSpeaking = avaVoice.status === 'speaking';
  const isAvaSpeakingRef = useRef(isAvaSpeaking);
  isAvaSpeakingRef.current = isAvaSpeaking;

  useEffect(() => {
    if (isAvaSpeaking) {
      setIsConversing(true);
      const pulseAnimation = () => {
        Animated.sequence([
          Animated.timing(dotPulseAnim, { toValue: 1.8, duration: 200, useNativeDriver: false }),
          Animated.timing(dotPulseAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]).start(() => {
          if (isAvaSpeakingRef.current) pulseAnimation();
        });
      };
      pulseAnimation();
    } else {
      setIsConversing(false);
      dotPulseAnim.setValue(1);
    }
  }, [isAvaSpeaking]);

  const clearConnectionTimeouts = useCallback(() => {
    connectionTimeouts.current.forEach(clearTimeout);
    connectionTimeouts.current = [];
  }, []);

  const handleConnectToAva = useCallback(async () => {
    if (videoState !== 'idle') return;
    trackInteraction('agent_connect', 'ava-desk-panel', { mode: 'video', agent: 'ava' });
    clearConnectionTimeouts();
    setVideoState('connecting');
    setConnectionStatus('Connecting to Ava...');
    playConnectionSound();
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      // 15s budget for the session-mint fetch. Without this, a stalled
      // Supabase pooler or Anam token mint masquerades as "stuck connecting".
      const fetchAbort = (typeof AbortSignal !== 'undefined' && (AbortSignal as any).timeout)
        ? (AbortSignal as any).timeout(15000)
        : undefined;
      const resp = await fetch('/api/anam/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          persona: 'ava',
          profile: avaProfileFallback,
        }),
        signal: fetchAbort,
      });
      if (!resp.ok) {
        let detail = '';
        try {
          const j = await resp.json();
          detail = j?.error || j?.message || '';
        } catch { /* non-JSON body */ }
        throw new Error(`Session ${resp.status}${detail ? ': ' + detail : ''}`);
      }
      const data = await resp.json();
      if (!data.sessionToken) throw new Error('No session token returned');
      setAnamSessionToken(data.sessionToken);
      setConnectionStatus('Starting Ava video...');
      connectionTimeouts.current.push(setTimeout(() => {
        setAnamSessionToken(null);
        setVideoState('idle');
        setConnectionStatus('Connect failed: video did not start within 40s');
      }, 40000));
    } catch (err) {
      clearConnectionTimeouts();
      setAnamSessionToken(null);
      setVideoState('idle');
      const reason = err instanceof Error
        ? (err.name === 'TimeoutError' ? 'session mint timed out (15s)' : err.message)
        : 'unknown error';
      setConnectionStatus(`Connect failed: ${reason}`);
    }
  }, [avaProfileFallback, clearConnectionTimeouts, videoState, session?.access_token]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'ava-anam-frame') return;
      if (event.data.type === 'connected') {
        clearConnectionTimeouts();
        setVideoState('connected');
        setConnectionStatus('');
        playSuccessSound();
        return;
      }
      if (event.data.type === 'error') {
        clearConnectionTimeouts();
        setAnamSessionToken(null);
        setVideoState('idle');
        const stage = event.data.stage ? ` [${event.data.stage}]` : '';
        const msg = event.data.message ? `: ${event.data.message}` : '';
        setConnectionStatus(`Connect failed${stage}${msg}`.slice(0, 240));
        return;
      }
      if (event.data.type === 'closed') {
        clearConnectionTimeouts();
        setAnamSessionToken(null);
        setVideoState('idle');
        const label = event.data.codeLabel || event.data.code;
        setConnectionStatus(label ? `Session ended (${label})` : 'Session ended');
        return;
      }
      if (event.data.type === 'show_cards') {
        const payload = event.data.payload || {};
        if (payload && typeof payload === 'object') {
          handleStructuredCards({
            artifact_type: String(payload.artifact_type || ''),
            records: Array.isArray(payload.records) ? payload.records : [],
            summary: String(payload.summary || ''),
            confidence: payload.confidence,
            card_cache_id: payload.card_cache_id,
          });
        }
        return;
      }
      if (event.data.type === 'tool_call_failed') {
        const msg = String(event.data?.payload?.errorMessage || '').trim();
        if (msg) {
          showVoiceError(msg.length > 120 ? `${msg.slice(0, 120)}...` : msg);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clearConnectionTimeouts, handleStructuredCards, showVoiceError]);

  const handleEndSession = useCallback(() => {
    trackInteraction('agent_disconnect', 'ava-desk-panel', { agent: 'ava' });
    clearConnectionTimeouts();
    setAnamSessionToken(null);
    setVideoState('idle');
    setConnectionStatus('');
  }, [clearConnectionTimeouts]);

  const voiceStatusLabel = useMemo(() => {
    if (!isSessionActive) return companyPillLabel || 'Tap to start';
    if (avaVoice.status === 'speaking') return 'Ava is speaking...';
    if (avaVoice.status === 'thinking') return 'Thinking...';
    return 'Listening...';
  }, [isSessionActive, avaVoice.status, companyPillLabel]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  // Show thinking indicator when submitted but no reasoning/text chunks yet
  const hasPendingChat = avaChatResult.status === 'submitted';

  useEffect(() => {
    return () => {
      runTimers.current.forEach(clearTimeout);
    };
  }, []);

  // W6: Approve-then-execute — chains approval into orchestrator resume, surfaces narration in chat
  const approveAndExecute = useCallback(async (approvalId: string) => {
    setIsConversing(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(`/api/authority-queue/${approvalId}/approve`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) throw new Error(`Approve returned ${res.status}`);
      const data = await res.json();
      const narrationText = data.narration || data.user_message || (data.executed ? 'Approved and executed successfully.' : 'Approved. Execution will follow.');
      appendLocalMessage('assistant', narrationText);
    } catch {
      appendLocalMessage('assistant', 'Approval failed. Please try again from the Authority Queue.');
    } finally {
      setIsConversing(false);
    }
  }, [session?.access_token, appendLocalMessage]);

  // Text chat send — routes through ElevenLabs agent (same as voice, unified pipeline)
  const onSend = useCallback(() => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatInput('');

    // Add user message to chat UI immediately
    appendLocalMessage('user', trimmed);

    // Send through ElevenLabs agent if session is active, otherwise fall back to LangGraph
    if (avaVoice.isActive) {
      avaVoice.sendText(trimmed);
    } else {
      // Fallback: send through LangGraph if no ElevenLabs session
      sendMessage({ text: trimmed });
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatInput, sendMessage, avaVoice, appendLocalMessage]);

  return (
    <View style={styles.card} testID="ava-desk-panel">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title} testID="ava-desk-title">Ava Desk</Text>
        </View>
        <View style={styles.tabs}>
          <TabButton label="Voice with Ava" icon="mic" active={mode === 'voice'} onPress={() => { trackInteraction('agent_mode_switch', 'ava-desk-panel', { mode: 'voice' }); setMode('voice'); }} testID="ava-voice-tab" />
          <TabButton label="Video with Ava" icon="videocam" active={mode === 'video'} onPress={() => { trackInteraction('agent_mode_switch', 'ava-desk-panel', { mode: 'video' }); setMode('video'); }} />
        </View>
      </View>

      <View style={[styles.surfaceContainer, mode === 'video' && videoState === 'connected' && styles.surfaceContainerExpanded]}>
        {/* Voice/Video error banner â€" surfaces errors that were previously swallowed */}
        {voiceError && (
          <Pressable
            onPress={() => setVoiceError(null)}
            style={{
              backgroundColor: 'rgba(239,68,68,0.15)',
              borderLeftWidth: 3,
              borderLeftColor: '#EF4444',
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginHorizontal: 12,
              marginTop: 4,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={{ color: '#FCA5A5', fontSize: 12, flex: 1 }}>{voiceError}</Text>
            <Ionicons name="close" size={14} color="#FCA5A5" />
          </Pressable>
        )}
        {mode === 'voice' ? (
          <View style={styles.voiceSurface}>
            <View style={styles.voiceHeader}>
              <Pressable 
                style={[
                  styles.companyPill,
                  isSessionActive && styles.companyPillActive,
                ]} 
                onPress={handleCompanyPillPress}
                testID="ava-company-pill"
              >
                <Animated.View 
                  style={[
                    styles.onlineDot,
                    isSessionActive && styles.onlineDotActive,
                    { 
                      transform: [{ scale: dotPulseAnim }],
                    },
                    isAvaSpeaking && Platform.OS === 'web' && {
                      boxShadow: '0 0 12px #3B82F6, 0 0 24px #3B82F6, 0 0 36px rgba(59,130,246,0.6)',
                    },
                  ]}
                />
                <Text style={styles.companyName} testID="ava-company-pill-text">
                  {avaVoice.isActive ? 'Talking with Ava...' : companyPillLabel}
                </Text>
              </Pressable>
            </View>

            <View style={styles.orbWrap}>
              {Platform.OS === 'web' ? (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <AvaOrbVideoInline size={320} />
                </Animated.View>
              ) : (
                <View style={styles.orbPlaceholderLarge}>
                  <Ionicons name="sparkles" size={80} color={Colors.accent.cyan} />
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.videoSurface}>
            {/* Anam iframe — loads hidden, fades in when SDK fires SESSION_READY */}
            {anamSessionToken && Platform.OS === 'web' && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: videoState === 'connected' ? 2 : 0,
                overflow: 'hidden', borderRadius: 12,
              } as any}>
                <iframe
                  key={anamSessionToken}
                  title="Ava video"
                  srcDoc={avaVideoFrameDoc || undefined}
                  allow="microphone; camera; autoplay; display-capture; encrypted-media"
                  style={{
                    width: '100%', height: '100%', border: '0', display: 'block', backgroundColor: '#000',
                    opacity: videoState === 'connected' ? 1 : 0,
                    transition: 'opacity 0.5s ease-in',
                  }}
                />
              </div>
            )}
            
            {/* FaceTime style local camera preview */}
            {videoState === 'connected' && mode === 'video' && (
              <>
                <LocalCameraPreview />
                <Pressable 
                  style={styles.exitSessionBtn} 
                  onPress={handleEndSession}
                >
                  <Ionicons name="log-out-outline" size={24} color="#fff" />
                </Pressable>
              </>
            )}
            
            {videoState !== 'connected' ? (
              <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800' }}
                style={styles.videoIdleContainer}
                imageStyle={{ opacity: 0.25 }}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.6)', 'transparent']}
                  style={styles.videoIdleVignetteTop}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
                <LinearGradient
                  colors={['transparent', Colors.background.primary]}
                  style={styles.videoIdleVignetteBottom}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
                <View style={styles.videoIdleCenter}>
                  {videoState === 'connecting' ? (
                    <>
                      <Animated.View style={[styles.connectingRing, { transform: [{ rotate: connectingAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
                        <View style={styles.connectingRingInner} />
                      </Animated.View>
                      <View style={styles.avaAvatarIdle}>
                        <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
                      </View>
                      {Platform.OS === 'web' ? (
                        <ShimmeringText
                          text={connectionStatus}
                          duration={2}
                          color={Colors.text.muted}
                          shimmerColor={Colors.accent.cyan}
                          style={{ fontSize: 14, fontWeight: '500', marginTop: 16 }}
                        />
                      ) : (
                        <Text style={styles.connectionStatusText}>{connectionStatus}</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <View style={styles.avaAvatarIdleGlow}>
                        <View style={styles.avaAvatarIdle}>
                          <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
                        </View>
                      </View>
                      <Text style={styles.videoIdleTitle}>Video with Ava</Text>
                      <Text style={styles.videoIdleSubtitle}>Start a face-to-face session</Text>
                      <Pressable style={styles.connectBtn} onPress={handleConnectToAva}>
                        <Ionicons name="videocam" size={18} color="#fff" />
                        <Text style={styles.connectBtnText}>Connect to Ava</Text>
                      </Pressable>
                      {connectionStatus ? (
                        <Text style={styles.connectionStatusText}>{connectionStatus}</Text>
                      ) : null}
                    </>
                  )}
                </View>
              </ImageBackground>
            ) : null}
          </View>
        )}
      </View>

      {isConversing && (
        <Animated.View 
          style={[
            styles.divider, 
            { 
              backgroundColor: Colors.accent.cyan,
              height: 2,
              transform: [{ scaleY: voiceLineAnim }],
              ...(Platform.OS === 'web' ? {
                boxShadow: '0 0 10px #3B82F6, 0 0 20px #3B82F6, 0 0 30px rgba(59,130,246,0.6)',
              } : {}),
            }
          ]} 
        />
      )}

        <View style={styles.chatDock}>
        <ScrollView 
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <MessagePartRenderer key={msg.id} message={msg} agent="ava" />
          ))}
          {hasPendingChat && (
            <ThinkingIndicator
              agent="ava"
              text="Ava is thinking..."
              style={{ marginTop: 4, marginBottom: 8 }}
            />
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <Pressable style={styles.attachBtn} onPress={() => {
            if (Platform.OS === 'web') {
              const fileInput = document.createElement('input');
              fileInput.type = 'file';
              fileInput.accept = '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.csv';
              fileInput.onchange = async (e: any) => {
                const file = e.target?.files?.[0];
                if (!file) return;
                appendLocalMessage('user', `Attached: ${file.name}`);
                try {
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('suite_id', suiteId || '');
                  const headers: Record<string, string> = {};
                  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                  const resp = await fetch('/v1/tools/analyze-document', { method: 'POST', headers, body: formData });
                  if (resp.ok) {
                    const result = await resp.json();
                    const preview = result.extracted_text || 'Document received but text extraction is pending.';
                    appendLocalMessage('assistant', `I received ${file.name}. ${preview}`);
                  } else {
                    appendLocalMessage('assistant', `I received ${file.name} but could not analyze it right now. I have it saved for review.`);
                  }
                } catch {
                  appendLocalMessage('assistant', `I received ${file.name} but had trouble processing it. It has been saved.`);
                }
              };
              fileInput.click();
            }
          }}>
            <Ionicons name="attach" size={20} color={Colors.text.secondary} />
          </Pressable>
          <TextInput
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Message Ava..."
            placeholderTextColor={Colors.text.tertiary}
            style={styles.input}
            onSubmitEditing={onSend}
            returnKeyType="send"
          />
          <Pressable style={styles.sendBtn} onPress={onSend}>
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function TabButton({ label, icon, active, onPress, testID }: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]} testID={testID}>
      <Ionicons name={icon} size={14} color={active ? Colors.accent.cyan : Colors.text.tertiary} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1C1C1E',
    flex: 1,
    minHeight: 840,
  } as any,
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    zIndex: 10,
  },
  headerLeft: {},
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#242426',
  },
  tabText: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.text.primary,
  },
  surfaceContainer: {
    height: 360,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  surfaceContainerExpanded: {
    flex: 1,
    height: 'auto',
  } as any,
  voiceSurface: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  voiceHeader: {
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  companyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#242426',
    borderRadius: 20,
    cursor: 'pointer',
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.2s ease',
    } : {}),
  } as any,
  companyPillActive: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 16px rgba(59,130,246,0.3)',
    } : {}),
  } as any,
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  onlineDotActive: {
    backgroundColor: '#3B82F6',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 8px #3B82F6',
    } : {}),
  } as any,
  companyName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  orbWrap: { 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8,
  },
  orbPlaceholder: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  orbPlaceholderLarge: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 140,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  listeningText: {
    fontSize: 16,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  listeningTextClose: {
    fontSize: 16,
    color: '#A1A1AA',
    fontWeight: '500',
    marginTop: 12,
  },
  voiceControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startCallBtn: {
    backgroundColor: '#22c55e',
  },
  floatingMicOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 20px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.15)',
    } : {}),
  } as any,
  floatingMicOrbActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 20px rgba(59,130,246,0.6), 0 0 40px rgba(59,130,246,0.4)',
    } : {}),
  } as any,
  videoSurface: {
    flex: 1,
    position: 'relative',
  },
  videoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  videoHeader: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  sessionBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(59,130,246,0.3)',
    borderRadius: 4,
  },
  sessionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  liveIndicators: {
    flexDirection: 'row',
    gap: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  avaAvatarWrap: {
    alignItems: 'center',
    gap: 8,
  },
  avaAvatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  avaAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1a3a5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avaAvatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3B82F6',
  },
  avaName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  avaStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  videoCompanyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoCompanyText: {
    fontSize: 13,
    color: '#D4D4D8',
  },
  videoControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#343436',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
  },
  chatDock: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  } as any,
  chatScroll: {
    flex: 1,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web' ? {
      scrollbarWidth: 'none',
    } : {}),
  } as any,
  chatContent: {
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.background.tertiary,
    fontSize: 13,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.cyan,
  },
  anamContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  endSessionBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 20,
  },
  endSessionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  videoIdleContainer: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  } as any,
  videoIdleVignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  videoIdleVignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  videoIdleCenter: {
    alignItems: 'center',
    gap: 16,
    zIndex: 10,
  },
  avaAvatarIdle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  avaAvatarIdleGlow: {
    padding: 8,
    borderRadius: 48,
    backgroundColor: 'rgba(59,130,246,0.05)',
  },
  videoIdleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 8,
  },
  videoIdleSubtitle: {
    fontSize: 13,
    color: Colors.text.tertiary,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 24,
    marginTop: 8,
  },
  connectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  connectingRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: Colors.accent.cyan,
    borderRightColor: 'rgba(59,130,246,0.3)',
  },
  connectingRingInner: {
    width: '100%',
    height: '100%',
  },
  connectionStatusText: {
    fontSize: 14,
    color: Colors.accent.cyan,
    fontWeight: '500',
    marginTop: 16,
  },
  localPreviewContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 80,
    height: 110,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
    overflow: 'hidden',
    backgroundColor: '#000',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  localPreviewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
  },
  localPreviewOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(59,130,246,0.05)',
  },
  exitSessionBtn: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59,130,246,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
      backdropFilter: 'blur(8px)',
    } : {}),
  } as any,
});

export function AvaDeskPanel() {
  return (
    <PageErrorBoundary pageName="ava-desk-panel">
      <AvaDeskPanelInner />
    </PageErrorBoundary>
  );
}
