/**
 * @deprecated Replaced by LiveKitConferenceProvider which uses <LiveKitRoom>
 * from @livekit/components-react as of Phase 3 Group C-2.
 *
 * LiveKit Client Configuration
 *
 * Provides connection helpers for LiveKit rooms.
 * Used by Nora's conference feature (V1).
 */
import {
  Room,
  RoomEvent,
  RoomOptions,
  ConnectionState,
} from 'livekit-client';
import { ENTERPRISE_ROOM_OPTIONS } from '@/lib/livekit-config';

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

const LIVEKIT_URL =
  process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://aspire-3rdm9zjn.livekit.cloud';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new Room instance with Aspire defaults.
 */
export function createRoom(options?: Partial<RoomOptions>): Room {
  return new Room({ ...ENTERPRISE_ROOM_OPTIONS, ...options });
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
