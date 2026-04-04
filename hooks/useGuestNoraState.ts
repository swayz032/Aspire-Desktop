/**
 * useGuestNoraState — Subscribe to Nora's live state via SSE for guest clients.
 *
 * Connects to GET /api/conference/nora-state/:roomName (public SSE endpoint).
 * Returns the current Nora state and speaking status, updated in real-time.
 *
 * Fallback: If SSE fails or is unavailable, stays at 'idle'.
 */
import { useState, useEffect, useRef } from 'react';
import type { RoomAvaState } from '@/components/session/RoomAvaTile';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

interface NoraStatePayload {
  state: RoomAvaState;
  isSpeaking: boolean;
  updatedAt: number;
}

interface UseGuestNoraStateReturn {
  noraState: RoomAvaState;
  isNoraSpeaking: boolean;
}

export function useGuestNoraState(roomName: string | undefined): UseGuestNoraStateReturn {
  const [noraState, setNoraState] = useState<RoomAvaState>('idle');
  const [isNoraSpeaking, setIsNoraSpeaking] = useState(false);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!roomName) return;

    let eventSource: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const connect = () => {
      if (destroyed) return;

      try {
        eventSource = new EventSource(
          `${API_BASE}/api/conference/nora-state/${encodeURIComponent(roomName)}`
        );

        eventSource.onmessage = (event) => {
          try {
            const payload: NoraStatePayload = JSON.parse(event.data);
            setNoraState(payload.state);
            setIsNoraSpeaking(payload.isSpeaking);
            retryCountRef.current = 0; // Reset on successful message
          } catch (_e) {
            // Ignore malformed events
          }
        };

        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;

          if (destroyed) return;

          // Exponential backoff: 1s, 2s, 4s, 8s, max 15s
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 15000);
          retryCountRef.current += 1;
          retryTimeout = setTimeout(connect, delay);
        };

        eventSource.onopen = () => {
          retryCountRef.current = 0;
        };
      } catch (_e) {
        // EventSource constructor failed — retry with backoff
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 15000);
        retryCountRef.current += 1;
        retryTimeout = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      destroyed = true;
      eventSource?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [roomName]);

  return { noraState, isNoraSpeaking };
}
