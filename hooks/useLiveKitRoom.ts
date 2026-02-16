/**
 * useLiveKitRoom hook
 *
 * Connects to a LiveKit room and maps RemoteParticipant[] into the existing
 * ConferenceParticipant[] interface used by ParticipantTile.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Track,
  ConnectionState,
  RemoteTrackPublication,
  ParticipantEvent,
} from 'livekit-client';
import { createRoom, connectToRoom, disconnectRoom } from '@/lib/livekit';
import type { ConferenceParticipant } from '@/components/session/ParticipantTile';

interface UseLiveKitRoomOptions {
  /** JWT from POST /api/livekit/token */
  token: string | null;
  /** LiveKit server URL (uses env default if omitted) */
  url?: string;
}

interface UseLiveKitRoomResult {
  /** Participants mapped to the UI interface */
  participants: ConferenceParticipant[];
  /** Current connection state */
  connectionState: ConnectionState;
  /** The raw LiveKit Room instance */
  room: Room | null;
  /** Connect to room (call after token is available) */
  connect: () => Promise<void>;
  /** Disconnect from room */
  disconnect: () => Promise<void>;
  /** Whether we are currently connected */
  isConnected: boolean;
}

function mapParticipant(
  p: RemoteParticipant | LocalParticipant,
  isLocal: boolean,
): ConferenceParticipant {
  const audioTrack = p.getTrackPublication(Track.Source.Microphone);
  const videoTrack = p.getTrackPublication(Track.Source.Camera);

  return {
    id: p.identity,
    name: p.name || p.identity,
    role: isLocal ? 'Host' : undefined,
    isMuted: audioTrack ? audioTrack.isMuted : true,
    isVideoOff: videoTrack ? videoTrack.isMuted || !videoTrack.isSubscribed : true,
    isSpeaking: p.isSpeaking,
    isHost: isLocal,
  };
}

export function useLiveKitRoom({
  token,
  url,
}: UseLiveKitRoomOptions): UseLiveKitRoomResult {
  const roomRef = useRef<Room | null>(null);
  const [participants, setParticipants] = useState<ConferenceParticipant[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );

  // Refresh participant list from room state
  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setParticipants([]);
      return;
    }

    const mapped: ConferenceParticipant[] = [];

    // Local participant first
    if (room.localParticipant) {
      mapped.push(mapParticipant(room.localParticipant, true));
    }

    // Remote participants
    room.remoteParticipants.forEach((rp) => {
      mapped.push(mapParticipant(rp, false));
    });

    setParticipants(mapped);
  }, []);

  // Connect
  const connect = useCallback(async () => {
    if (!token) return;
    if (!roomRef.current) {
      roomRef.current = createRoom();
    }
    const room = roomRef.current;

    // Wire events
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      setConnectionState(state);
    });
    room.on(RoomEvent.ParticipantConnected, refreshParticipants);
    room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
    room.on(RoomEvent.TrackSubscribed, refreshParticipants);
    room.on(RoomEvent.TrackUnsubscribed, refreshParticipants);
    room.on(RoomEvent.TrackMuted, refreshParticipants);
    room.on(RoomEvent.TrackUnmuted, refreshParticipants);
    room.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
    room.on(RoomEvent.LocalTrackPublished, refreshParticipants);

    await connectToRoom(room, token, url);
    refreshParticipants();
  }, [token, url, refreshParticipants]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await disconnectRoom(roomRef.current);
      roomRef.current = null;
      setParticipants([]);
      setConnectionState(ConnectionState.Disconnected);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  return {
    participants,
    connectionState,
    room: roomRef.current,
    connect,
    disconnect,
    isConnected: connectionState === ConnectionState.Connected,
  };
}
