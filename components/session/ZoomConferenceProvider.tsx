/**
 * ZoomConferenceProvider
 *
 * Wraps children with Zoom Video SDK client lifecycle management.
 * Manages init/join/leave and exposes participant state via React context.
 *
 * On non-web platforms, renders children directly (Zoom Video SDK is browser-only).
 *
 * Audio: Zoom SDK built-in noise suppression (no external Krisp needed).
 * Video: 1080p capture via VIDEO_CAPTURE_DEFAULTS from zoom-config.ts.
 * Init options: ZOOM_INIT_OPTIONS from zoom-config.ts (single source of truth).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { ZOOM_INIT_OPTIONS, SESSION_CONFIG, VIDEO_CAPTURE_DEFAULTS } from '@/lib/zoom-config';
import { reportProviderError } from '@/lib/providerErrorReporter';

// ── Types ───────────────────────────────────────────────────────────────────

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface ZoomUserPayload {
  userId: number | string;
  displayName: string;
  bVideoOn?: boolean;
  muted?: boolean;
  isHost?: boolean;
}

function normalizeZoomUserId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Opaque handle for the Zoom Video SDK client instance.
 * Actual type is `ReturnType<typeof ZoomVideo.createClient>` but we avoid
 * a top-level import so the component compiles before `@zoom/videosdk` is
 * installed. Consumers who need typed access should cast or import the SDK
 * types themselves.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
type ZoomClient = {
  // Typed surface used within this provider — extend as needed
  init: (language: string, region: string, options: Record<string, unknown>) => Promise<void>;
  join: (topic: string, token: string, userName: string) => Promise<void>;
  leave: () => Promise<void>;
  getCurrentUserInfo: () => ZoomUserPayload | null;
  getAllUser: () => ZoomUserPayload[];
  getMediaStream: () => ZoomMediaStream;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
};

type MediaDevice = { deviceId: string; label: string };

type ZoomMediaStream = {
  // Audio
  startAudio: () => Promise<void>;
  stopAudio: () => Promise<void>;
  muteAudio: (userId?: number) => Promise<void>;
  unmuteAudio: (userId?: number) => Promise<void>;
  enableBackgroundNoiseSuppression?: (enable: boolean) => Promise<void>;
  enableOriginalSound?: (enable: boolean) => Promise<void>;
  getMicList: () => MediaDevice[];
  getSpeakerList: () => MediaDevice[];
  switchMicrophone: (deviceId: string) => Promise<void>;
  switchSpeaker: (deviceId: string) => Promise<void>;
  getActiveMicrophone: () => string;
  getActiveSpeaker: () => string;
  // Video
  startVideo: (options?: Record<string, unknown>) => Promise<void>;
  stopVideo: () => Promise<void>;
  attachVideo: (
    userId: number,
    videoQuality: number,
    element?: string | HTMLElement,
  ) => Promise<HTMLElement | { type: string; reason: string }>;
  detachVideo: (
    userId: number,
    element?: string | HTMLElement,
  ) => Promise<HTMLElement | HTMLElement[]>;
  /** @deprecated Use attachVideo instead */
  renderVideo?: (canvas: HTMLCanvasElement, userId: number, width: number, height: number, x: number, y: number, rotation: number) => void;
  /** @deprecated Use detachVideo instead */
  stopRenderVideo?: (canvas: HTMLCanvasElement, userId: number) => void;
  getCameraList: () => MediaDevice[];
  switchCamera: (deviceId: string) => Promise<void>;
  enableHardwareAcceleration?: (enable: boolean) => Promise<void>;
  isSupportHDVideo?: () => boolean;
  getVideoMaxQuality?: () => number;
  getMaxRenderableVideos?: () => number;
  // Virtual background
  updateVirtualBackgroundImage?: (imageUrl: string | undefined) => Promise<void>;
  previewVirtualBackground?: (canvas: HTMLCanvasElement, imageUrl: string | undefined) => Promise<void>;
  stopPreviewVirtualBackground?: () => Promise<void>;
  // Screen share
  startShareScreen: () => Promise<void>;
  stopShareScreen: () => Promise<void>;
  startShareView: (canvas: HTMLCanvasElement, userId: number) => Promise<void>;
};

export interface ZoomParticipant {
  userId: number;
  displayName: string;
  isVideoOn: boolean;
  isMuted: boolean;
  isLocal: boolean;
  isHost: boolean;
}

export interface ZoomChatMessage {
  sender: { name: string; userId: number };
  message: string;
  timestamp: number;
  receiver?: { name: string; userId: number };
}

export interface ZoomTranscriptEntry {
  text: string;
  speakerName: string;
  speakerId: number;
  timestamp: number;
  language?: string;
}

export interface ZoomContextValue {
  /** Zoom Video SDK client instance (null on non-web or before init) */
  client: ZoomClient | null;
  /** MediaStream from client.getMediaStream() */
  stream: ZoomMediaStream | null;
  participants: ZoomParticipant[];
  activeSpeakerId: number | null;
  isConnected: boolean;
  connectionState: ConnectionState;
  error: string | null;
  isRecording: boolean;
  networkQuality: { uplink: number; downlink: number };
  screenShareUserId: number | null;
  /** Zoom SDK chat messages (Room tab) */
  chatMessages: ZoomChatMessage[];
  /** Send chat message to all or specific user */
  sendChatMessage: (text: string, userId?: number) => Promise<void>;
  /** Live transcription entries */
  transcriptEntries: ZoomTranscriptEntry[];
  /** Whether live transcription is active */
  isTranscribing: boolean;
  /** Start/stop live transcription */
  toggleTranscription: () => Promise<void>;
}

const DEFAULT_CONTEXT: ZoomContextValue = {
  client: null,
  stream: null,
  participants: [],
  activeSpeakerId: null,
  isConnected: false,
  connectionState: 'idle',
  error: null,
  isRecording: false,
  networkQuality: { uplink: 5, downlink: 5 },
  screenShareUserId: null,
  chatMessages: [],
  sendChatMessage: async () => {},
  transcriptEntries: [],
  isTranscribing: false,
  toggleTranscription: async () => {},
};

const ZoomContext = createContext<ZoomContextValue>(DEFAULT_CONTEXT);

// ── Props ───────────────────────────────────────────────────────────────────

interface ZoomConferenceProviderProps {
  /** JWT token from Zoom Video SDK signature endpoint */
  token: string | null;
  /** Session topic (room name) */
  topic: string;
  /** Display name for the local participant */
  userName: string;
  /** Whether to start video on join (false for voice-only mode) */
  startVideo?: boolean;
  /** Whether to auto-start cloud recording on join */
  autoRecord?: boolean;
  /** Child components rendered inside the Zoom context */
  children: React.ReactNode;
}

// ── Helper: map SDK user payload to ZoomParticipant ─────────────────────────

function toParticipant(
  user: ZoomUserPayload,
  localUserId: number | null,
): ZoomParticipant {
  const normalizedId = normalizeZoomUserId(user.userId) ?? -1;
  return {
    userId: normalizedId,
    displayName: user.displayName,
    isVideoOn: user.bVideoOn ?? false,
    isMuted: user.muted ?? true,
    isLocal: normalizedId === localUserId,
    isHost: user.isHost ?? false,
  };
}

function bindOneTimeUserGesture(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];
  let fired = false;

  const cleanup = () => {
    for (const eventName of events) {
      window.removeEventListener(eventName, onGesture, true);
    }
  };

  const onGesture = () => {
    if (fired) return;
    fired = true;
    cleanup();
    callback();
  };

  for (const eventName of events) {
    window.addEventListener(eventName, onGesture, { capture: true, passive: true, once: true });
  }

  return cleanup;
}

// ── Provider (web-only internals) ───────────────────────────────────────────

function ZoomConferenceProviderWeb({
  token,
  topic,
  userName,
  startVideo: startVideoProp = true,
  autoRecord: autoRecordProp = false,
  children,
}: ZoomConferenceProviderProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ZoomParticipant[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<number | null>(null);
  const [stream, setStream] = useState<ZoomMediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [networkQuality, setNetworkQuality] = useState({ uplink: 5, downlink: 5 });
  const [screenShareUserId, setScreenShareUserId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ZoomChatMessage[]>([]);
  const [transcriptEntries, setTranscriptEntries] = useState<ZoomTranscriptEntry[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const chatClientRef = useRef<any>(null);
  const transcriptionClientRef = useRef<any>(null);

  // Refs to avoid stale closures in event handlers
  const clientRef = useRef<ZoomClient | null>(null);
  const localUserIdRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // ── Init + Join ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;

    mountedRef.current = true;
    let destroyed = false;
    let releaseDeferredAudioStart: (() => void) | null = null;

    async function initAndJoin() {
      try {
        // Dynamic import — Zoom SDK is large, only load when needed
        // @ts-expect-error — @zoom/videosdk types resolved at runtime via dynamic import
        const ZoomVideo = (await import('@zoom/videosdk')).default as {
          createClient: () => ZoomClient;
          destroyClient: () => void;
        };

        if (destroyed) return;

        const client = ZoomVideo.createClient();
        clientRef.current = client;

        if (!mountedRef.current) return;
        setConnectionState('connecting');

        // Init with project-wide config
        const { language, region, ...restOptions } = ZOOM_INIT_OPTIONS;
        await client.init(language, region, restOptions);

        if (destroyed) return;

        // Join session (token guaranteed non-null by guard at top of effect)
        await client.join(topic, token as string, userName);

        if (destroyed) return;
        setConnectionState('connected');

        // Capture local user ID for isLocal detection
        const currentUser = client.getCurrentUserInfo?.();
        if (currentUser) {
          localUserIdRef.current = currentUser.userId;
        }

        // Get media stream handle
        const mediaStream = client.getMediaStream();
        setStream(mediaStream);

        const syncParticipantsFromClient = () => {
          const allUsers = client.getAllUser?.() || [];
          const current = client.getCurrentUserInfo?.();
          const usersById = new Map<number, ZoomUserPayload>();

          const currentId = normalizeZoomUserId(current?.userId);
          if (currentId !== null) {
            localUserIdRef.current = currentId;
          }

          for (const user of allUsers) {
            const userId = normalizeZoomUserId(user?.userId);
            if (userId !== null) usersById.set(userId, { ...user, userId });
          }

          // Some SDK timing paths omit local user in early getAllUser snapshots.
          // Always include current user so self-view tile cannot disappear.
          if (currentId !== null && current && !usersById.has(currentId)) {
            usersById.set(currentId, { ...current, userId: currentId });
          }

          setParticipants(() => {
            if (usersById.size === 0) return [];
            return Array.from(usersById.values()).map((u) =>
              toParticipant(u, localUserIdRef.current),
            );
          });
        };

        // Prime participant state immediately after join so local tile appears
        // without waiting for media startup or late user-updated events.
        syncParticipantsFromClient();

        // Start audio and video in PARALLEL — no delay between them.
        // Both use separate device streams (mic vs camera), no permission race.
        const mediaPromises: Promise<void>[] = [];

        if (SESSION_CONFIG.autoStartAudio) {
          const startAudio = async () => {
            if (destroyed || !mountedRef.current) return;
            try {
              await mediaStream.startAudio();
            } catch (_e: unknown) {
              reportProviderError({ provider: 'zoom', action: 'auto_start_audio', error: _e, component: 'ZoomConferenceProvider' });
            }
          };

          const hasUserActivation =
            typeof navigator !== 'undefined'
            && !!(navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }).userActivation?.hasBeenActive;

          if (hasUserActivation || typeof window === 'undefined') {
            mediaPromises.push(startAudio());
          } else {
            // Delay auto-audio start until the first user gesture to satisfy browser autoplay policy.
            releaseDeferredAudioStart = bindOneTimeUserGesture(() => {
              void startAudio();
            });
          }
        }

        if (SESSION_CONFIG.autoStartVideo && startVideoProp) {
          mediaPromises.push(
            mediaStream.startVideo({
              fullHd: VIDEO_CAPTURE_DEFAULTS.fullHd,
              hd: VIDEO_CAPTURE_DEFAULTS.hd,
              fps: VIDEO_CAPTURE_DEFAULTS.fps,
              facingMode: VIDEO_CAPTURE_DEFAULTS.facingMode,
            }).then(() => {
              syncParticipantsFromClient();
            }).catch(() =>
              // Fallback: try HD only if fullHd fails
              mediaStream.startVideo({
                hd: VIDEO_CAPTURE_DEFAULTS.hd,
                fps: VIDEO_CAPTURE_DEFAULTS.fps,
                facingMode: VIDEO_CAPTURE_DEFAULTS.facingMode,
              }).then(() => {
                syncParticipantsFromClient();
              }).catch((_e: unknown) => {
                reportProviderError({ provider: 'zoom', action: 'auto_start_video', error: _e, component: 'ZoomConferenceProvider' });
              })
            )
          );
        }

        await Promise.all(mediaPromises);
        if (destroyed) return;
        // Run immediate post-media sync + short follow-up retries because
        // Zoom may publish local participant/video state a little after join.
        syncParticipantsFromClient();
        for (const delayMs of [400, 1000, 2200]) {
          setTimeout(() => {
            if (destroyed || !mountedRef.current) return;
            syncParticipantsFromClient();
          }, delayMs);
        }

        // Enable Zoom SDK background noise suppression for crystal clear audio
        if (SESSION_CONFIG.autoEnableNoiseSuppression) {
          try {
            if (typeof mediaStream.enableBackgroundNoiseSuppression === 'function') {
              await mediaStream.enableBackgroundNoiseSuppression(true);
            }
          } catch (_e) {
            // Non-critical — built-in WebRTC noise suppression still active
          }
        }

        // Auto-start cloud recording if requested (purpose-driven)
        if (autoRecordProp) {
          try {
            const rc = (client as any).getRecordingClient?.();
            if (rc && typeof rc.startCloudRecording === 'function') {
              await rc.startCloudRecording();
              // Don't set isRecording here — let the 'recording-change' event
              // handler (line ~549) be the sole authoritative writer.
            }
          } catch (_e) {
            reportProviderError({
              provider: 'zoom',
              action: 'auto_start_recording',
              error: _e,
              component: 'ZoomConferenceProvider',
            });
          }
        }

        // Enable hardware acceleration for better video performance
        try {
          if (typeof mediaStream.enableHardwareAcceleration === 'function') {
            await mediaStream.enableHardwareAcceleration(true);
          }
        } catch (_e) { /* non-critical */ }

        // Initialize Zoom SDK Chat client
        try {
          const cc = (client as any).getChatClient?.();
          if (cc) chatClientRef.current = cc;
        } catch (_e) { /* non-critical */ }

        // Initialize Live Transcription client
        try {
          const tc = (client as any).getLiveTranscriptionClient?.();
          if (tc) transcriptionClientRef.current = tc;
        } catch (_e) { /* non-critical */ }

        // Listen for Zoom SDK chat messages
        client.on('chat-on-message', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          const payload = args[0] as ZoomChatMessage;
          if (payload && payload.message) {
            setChatMessages(prev => [...prev, payload]);
          }
        });

        // Listen for live transcription events
        client.on('caption-message', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          const payload = args[0] as { text: string; id: string; done: boolean; displayName: string; userId: number; language: string; timestamp: number };
          if (payload && payload.text && payload.done) {
            setTranscriptEntries(prev => [...prev, {
              text: payload.text,
              speakerName: payload.displayName,
              speakerId: payload.userId,
              timestamp: payload.timestamp || Date.now(),
              language: payload.language,
            }]);
          }
        });

        // Build initial participants list (retry after 1s if empty — SDK may still be syncing)
        syncParticipantsFromClient();
        if ((client.getAllUser?.() || []).length === 0 && !destroyed) {
          // Retry — sometimes getAllUser returns empty right after join
          setTimeout(() => {
            if (destroyed || !mountedRef.current) return;
            syncParticipantsFromClient();
          }, 1500);
        }

        // ── Event listeners ─────────────────────────────────────────────

        client.on('user-added', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          syncParticipantsFromClient();
        });

        client.on('user-removed', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          const raw = args[0];
          const payload: ZoomUserPayload[] = Array.isArray(raw) ? raw : [raw as ZoomUserPayload];
          const removedIds = new Set(
            payload
              .map((u) => normalizeZoomUserId(u?.userId))
              .filter((id): id is number => id !== null),
          );
          syncParticipantsFromClient();
          setActiveSpeakerId((prev) =>
            prev !== null && removedIds.has(prev) ? null : prev,
          );
        });

        client.on('user-updated', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          syncParticipantsFromClient();
        });

        client.on('active-speaker', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          const payload = args[0] as Array<{ userId: number }>;
          if (payload.length > 0) {
            setActiveSpeakerId(payload[0].userId);
          }
        });

        client.on('connection-change', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          const payload = args[0] as { state: string };
          switch (payload.state) {
            case 'Connected':
              setConnectionState('connected');
              syncParticipantsFromClient();
              break;
            case 'Reconnecting':
              setConnectionState('connecting');
              break;
            case 'Closed':
            case 'Fail':
              setConnectionState('disconnected');
              break;
            default:
              break;
          }
        });

        client.on('recording-change', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          const payload = args[0] as { state: string };
          setIsRecording(payload.state === 'Recording');
        });

        client.on('active-share-change', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          const payload = args[0] as { state: string; userId: number };
          setScreenShareUserId(payload.state === 'Active' ? payload.userId : null);
        });

        client.on('network-quality-change', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          const payload = args[0] as { level: number; type: 'uplink' | 'downlink' };
          setNetworkQuality(prev => ({ ...prev, [payload.type]: payload.level }));
        });

        setConnectionState('connected');
        setError(null);
      } catch (err) {
        if (destroyed) return;
        const message =
          err instanceof Error ? err.message : 'Zoom session failed to initialize';
        setConnectionState('error');
        setError(message);
        reportProviderError({
          provider: 'zoom',
          action: 'init_join',
          error: err,
          component: 'ZoomConferenceProvider',
        });
      }
    }

    initAndJoin();

    // ── Cleanup ─────────────────────────────────────────────────────────
    return () => {
      destroyed = true;
      mountedRef.current = false;
      if (releaseDeferredAudioStart) {
        releaseDeferredAudioStart();
        releaseDeferredAudioStart = null;
      }

      const client = clientRef.current;
      if (client) {
        (async () => {
          try {
            await client.leave();
          } catch (_e) {
            // Session may already be ended
          }
          try {
            const ZoomVideo = (await import('@zoom/videosdk')).default as {
              destroyClient: () => void;
            };
            ZoomVideo.destroyClient();
          } catch (_e) {
            // Cleanup best-effort
          }
          clientRef.current = null;
        })();
      }
    };
  }, [token, topic, userName, startVideoProp, autoRecordProp]);

  // ── Chat + Transcription methods ──────────────────────────────────────

  const sendChatMessage = useCallback(async (text: string, userId?: number) => {
    const cc = chatClientRef.current;
    if (!cc) return;
    try {
      if (userId) {
        await cc.send(text, userId);
      } else {
        await cc.sendToAll(text);
      }
    } catch (_e) {
      reportProviderError({ provider: 'zoom', action: 'send_chat', error: _e, component: 'ZoomConferenceProvider' });
    }
  }, []);

  const toggleTranscription = useCallback(async () => {
    const tc = transcriptionClientRef.current;
    if (!tc) return;
    try {
      if (isTranscribing) {
        await tc.disableCaptions(true);
        setIsTranscribing(false);
      } else {
        await tc.startLiveTranscription();
        setIsTranscribing(true);
      }
    } catch (_e) {
      reportProviderError({ provider: 'zoom', action: 'toggle_transcription', error: _e, component: 'ZoomConferenceProvider' });
    }
  }, [isTranscribing]);

  // ── Context value ─────────────────────────────────────────────────────

  const contextValue: ZoomContextValue = {
    client: clientRef.current,
    stream,
    participants,
    activeSpeakerId,
    isConnected: connectionState === 'connected',
    connectionState,
    error,
    isRecording,
    networkQuality,
    screenShareUserId,
    chatMessages,
    sendChatMessage,
    transcriptEntries,
    isTranscribing,
    toggleTranscription,
  };

  return (
    <ZoomContext.Provider value={contextValue}>
      {children}
    </ZoomContext.Provider>
  );
}

// ── Exported Provider ───────────────────────────────────────────────────────

export function ZoomConferenceProvider(props: ZoomConferenceProviderProps) {
  // Non-web platforms: render children with null context (Zoom SDK is browser-only)
  if (Platform.OS !== 'web') {
    return (
      <ZoomContext.Provider value={DEFAULT_CONTEXT}>
        {props.children}
      </ZoomContext.Provider>
    );
  }

  // No token yet: render children without initializing
  if (!props.token) {
    return (
      <ZoomContext.Provider value={DEFAULT_CONTEXT}>
        {props.children}
      </ZoomContext.Provider>
    );
  }

  return <ZoomConferenceProviderWeb {...props} />;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Full Zoom context — client, stream, participants, connection state.
 * Must be used inside <ZoomConferenceProvider>.
 */
export function useZoomContext(): ZoomContextValue {
  return useContext(ZoomContext);
}

/**
 * Participants array only — avoids re-renders from unrelated context changes.
 */
export function useZoomParticipants(): ZoomParticipant[] {
  const { participants } = useContext(ZoomContext);
  return participants;
}

/**
 * Active speaker ID — null when no one is speaking.
 */
export function useZoomActiveSpeaker(): number | null {
  const { activeSpeakerId } = useContext(ZoomContext);
  return activeSpeakerId;
}
