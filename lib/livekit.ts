/**
 * LiveKit Client Configuration
 *
 * Provides connection helpers for LiveKit rooms.
 * Used by Nora's conference feature (V1).
 */
import {
  Room,
  RoomEvent,
  VideoPresets,
  RoomOptions,
  ConnectionState,
} from 'livekit-client';

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

const LIVEKIT_URL =
  process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://aspire-dev.livekit.cloud';

// ---------------------------------------------------------------------------
// Default room options
// ---------------------------------------------------------------------------

const DEFAULT_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new Room instance with Aspire defaults.
 */
export function createRoom(options?: Partial<RoomOptions>): Room {
  return new Room({ ...DEFAULT_ROOM_OPTIONS, ...options });
}

/**
 * Connect to a LiveKit room using a token from the server.
 *
 * @param room - Room instance from `createRoom()`
 * @param token - JWT from POST /api/livekit/token
 * @param url - LiveKit server URL (defaults to env)
 */
export async function connectToRoom(
  room: Room,
  token: string,
  url: string = LIVEKIT_URL,
): Promise<void> {
  await room.connect(url, token);
}

/**
 * Cleanly disconnect from a LiveKit room.
 */
export async function disconnectRoom(room: Room): Promise<void> {
  await room.disconnect();
}

// Re-export useful types / enums for consumers
export { Room, RoomEvent, ConnectionState };
