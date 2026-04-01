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
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { ZOOM_INIT_OPTIONS, SESSION_CONFIG } from '@/lib/zoom-config';
import { reportProviderError } from '@/lib/providerErrorReporter';

// ── Types ───────────────────────────────────────────────────────────────────

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface ZoomUserPayload {
  userId: number;
  displayName: string;
  bVideoOn?: boolean;
  muted?: boolean;
  isHost?: boolean;
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

type ZoomMediaStream = {
  startAudio: () => Promise<void>;
};

export interface ZoomParticipant {
  userId: number;
  displayName: string;
  isVideoOn: boolean;
  isMuted: boolean;
  isLocal: boolean;
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
}

const DEFAULT_CONTEXT: ZoomContextValue = {
  client: null,
  stream: null,
  participants: [],
  activeSpeakerId: null,
  isConnected: false,
  connectionState: 'idle',
  error: null,
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
  /** Child components rendered inside the Zoom context */
  children: React.ReactNode;
}

// ── Helper: map SDK user payload to ZoomParticipant ─────────────────────────

function toParticipant(
  user: ZoomUserPayload,
  localUserId: number | null,
): ZoomParticipant {
  return {
    userId: user.userId,
    displayName: user.displayName,
    isVideoOn: user.bVideoOn ?? false,
    isMuted: user.muted ?? true,
    isLocal: user.userId === localUserId,
  };
}

// ── Provider (web-only internals) ───────────────────────────────────────────

function ZoomConferenceProviderWeb({
  token,
  topic,
  userName,
  children,
}: ZoomConferenceProviderProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ZoomParticipant[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<number | null>(null);
  const [stream, setStream] = useState<ZoomMediaStream | null>(null);

  // Refs to avoid stale closures in event handlers
  const clientRef = useRef<ZoomClient | null>(null);
  const localUserIdRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // ── Init + Join ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;

    mountedRef.current = true;
    let destroyed = false;

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

        // Capture local user ID for isLocal detection
        const currentUser = client.getCurrentUserInfo();
        if (currentUser) {
          localUserIdRef.current = currentUser.userId;
        }

        // Get media stream handle
        const mediaStream = client.getMediaStream();
        setStream(mediaStream);

        // Auto-start audio per config
        if (SESSION_CONFIG.autoStartAudio) {
          try {
            await mediaStream.startAudio();
          } catch (_e) {
            reportProviderError({
              provider: 'zoom',
              action: 'auto_start_audio',
              error: _e,
              component: 'ZoomConferenceProvider',
            });
          }
        }

        // Build initial participants list
        const allUsers = client.getAllUser();
        const mapped = allUsers.map((u: ZoomUserPayload) =>
          toParticipant(u, localUserIdRef.current),
        );
        setParticipants(mapped);

        // ── Event listeners ─────────────────────────────────────────────

        client.on('user-added', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          const payload = args[0] as ZoomUserPayload[];
          setParticipants((prev) => {
            const existing = new Set(prev.map((p) => p.userId));
            const added = payload
              .filter((u) => !existing.has(u.userId))
              .map((u) => toParticipant(u, localUserIdRef.current));
            return [...prev, ...added];
          });
        });

        client.on('user-removed', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          const payload = args[0] as ZoomUserPayload[];
          const removedIds = new Set(payload.map((u) => u.userId));
          setParticipants((prev) => prev.filter((p) => !removedIds.has(p.userId)));
          // Clear active speaker if they left
          setActiveSpeakerId((prev) =>
            prev !== null && removedIds.has(prev) ? null : prev,
          );
        });

        client.on('user-updated', (...args: unknown[]) => {
          if (!mountedRef.current) return;
          const payload = args[0] as ZoomUserPayload[];
          setParticipants((prev) => {
            const updateMap = new Map(payload.map((u) => [u.userId, u]));
            return prev.map((p) => {
              const update = updateMap.get(p.userId);
              if (!update) return p;
              return toParticipant(update, localUserIdRef.current);
            });
          });
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

      const client = clientRef.current;
      if (client) {
        (async () => {
          try {
            await client.leave();
          } catch (_e) {
            // Session may already be ended
          }
          try {
            // @ts-expect-error — @zoom/videosdk types resolved at runtime
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
  }, [token, topic, userName]);

  // ── Context value ─────────────────────────────────────────────────────

  const contextValue: ZoomContextValue = {
    client: clientRef.current,
    stream,
    participants,
    activeSpeakerId,
    isConnected: connectionState === 'connected',
    connectionState,
    error,
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
