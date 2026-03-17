/**
 * useDeepgramSTT hook
 *
 * Real-time speech-to-text using Deepgram Nova-3 via WebSocket.
 * Returns live transcription text from a MediaStream (microphone).
 */
import { useState, useRef, useCallback, useEffect } from 'react';

interface UseDeepgramSTTOptions {
  /** Whether to start listening immediately */
  autoStart?: boolean;
  /** Called each time a complete utterance is finalized by the STT engine */
  onUtterance?: (text: string) => void;
}

interface UseDeepgramSTTResult {
  /** The latest transcript text (interim or final) */
  transcript: string;
  /** Accumulated final transcripts */
  finalTranscript: string;
  /** Whether the STT connection is active */
  isListening: boolean;
  /** Start listening (requires microphone permission) */
  start: () => Promise<void>;
  /** Stop listening */
  stop: () => void;
  /** Mute/unmute the microphone track (pauses audio capture without stopping STT) */
  setMuted: (muted: boolean) => void;
  /** Any error that occurred */
  error: string | null;
}

export function useDeepgramSTT(
  options: UseDeepgramSTTOptions = {},
): UseDeepgramSTTResult {
  const onUtteranceRef = useRef(options.onUtterance);
  onUtteranceRef.current = options.onUtterance;
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_STT_RETRIES = 2;

  const stop = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retryCountRef.current = 0;
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsListening(false);
  }, []);

  /** Reconnect WebSocket STT reusing an existing mic stream (H17 retry). */
  const reconnectWs = useCallback(async (stream: MediaStream) => {
    try {
      setError(null);
      const resp = await fetch('/api/deepgram/token');
      if (!resp.ok) throw new Error('Voice service unavailable');
      const { token } = await resp.json();

      const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-3&punctuate=true&interim_results=true&endpointing=300`;
      const ws = new WebSocket(wsUrl, ['token', token]);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsListening(true);
        retryCountRef.current = 0;
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };
        mediaRecorder.start(250);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel?.alternatives?.[0]?.transcript) {
            const text = data.channel.alternatives[0].transcript;
            if (data.is_final) {
              setFinalTranscript((prev) => (prev ? `${prev} ${text}` : text));
              setTranscript('');
              if (text.trim()) onUtteranceRef.current?.(text.trim());
            } else {
              setTranscript(text);
            }
          }
        } catch { /* ignore non-JSON */ }
      };

      ws.onerror = () => {
        setError('Voice connection interrupted');
        stop();
      };

      ws.onclose = () => setIsListening(false);
    } catch (err: any) {
      setError(err.message);
      stop();
    }
  }, [stop]);

  const start = useCallback(async () => {
    try {
      setError(null);

      // Fetch token from server
      const resp = await fetch('/api/deepgram/token');
      if (!resp.ok) {
        throw new Error('Voice service unavailable');
      }
      const { token } = await resp.json();

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Connect to Deepgram via WebSocket — Nova-3 model
      // Browser MediaRecorder sends webm/opus — let Deepgram auto-detect container format
      const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-3&punctuate=true&interim_results=true&endpointing=300`;
      const ws = new WebSocket(wsUrl, ['token', token]);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsListening(true);

        // Use MediaRecorder to send audio chunks
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        mediaRecorder.start(250); // Send chunks every 250ms
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel?.alternatives?.[0]?.transcript) {
            const text = data.channel.alternatives[0].transcript;
            if (data.is_final) {
              setFinalTranscript((prev) => (prev ? `${prev} ${text}` : text));
              setTranscript('');
              if (text.trim()) {
                onUtteranceRef.current?.(text.trim());
              }
            } else {
              setTranscript(text);
            }
          }
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onerror = () => {
        // H17: Retry on error with exponential backoff (up to MAX_STT_RETRIES)
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        }
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        setIsListening(false);

        if (retryCountRef.current < MAX_STT_RETRIES) {
          const delay = 1000 * Math.pow(2, retryCountRef.current);
          retryCountRef.current++;
          setError(`Voice reconnecting (attempt ${retryCountRef.current})...`);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            // Re-use existing mic stream if still active
            if (streamRef.current && streamRef.current.active) {
              reconnectWs(streamRef.current);
            } else {
              // Mic stream died — full restart
              start();
            }
          }, delay);
        } else {
          setError('Voice connection interrupted');
          stop();
        }
      };

      ws.onclose = () => {
        setIsListening(false);
      };
    } catch (err: any) {
      setError(err.message);
      stop();
    }
  }, [stop, reconnectWs]);

  /** Mute/unmute the mic track without stopping STT. */
  const setMuted = useCallback((muted: boolean) => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      stop();
    };
  }, [stop]);

  return {
    transcript,
    finalTranscript,
    isListening,
    start,
    stop,
    setMuted,
    error,
  };
}
