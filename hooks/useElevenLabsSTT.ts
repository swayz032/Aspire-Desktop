/**
 * useElevenLabsSTT hook
 *
 * Speech-to-text using ElevenLabs Scribe via server-side proxy.
 * Records mic audio in chunks, sends to /api/elevenlabs/stt for transcription.
 *
 * Used by Finn, Ava, and Eli. Deepgram STT is for Nora only (LiveKit conference).
 * API key stays server-side — client never touches secrets (Law #9).
 */
import { useState, useRef, useCallback, useEffect } from 'react';

interface UseElevenLabsSTTOptions {
  /** Called each time a complete utterance is transcribed */
  onUtterance?: (text: string) => void;
  /** Silence threshold in ms before sending accumulated audio (default: 1500) */
  silenceTimeout?: number;
  /** JWT access token for authenticated API calls */
  accessToken?: string;
}

interface UseElevenLabsSTTResult {
  /** The latest transcript text */
  transcript: string;
  /** Whether the STT connection is active */
  isListening: boolean;
  /** Start listening (requires microphone permission) */
  start: () => Promise<void>;
  /** Stop listening */
  stop: () => void;
  /** Any error that occurred */
  error: string | null;
}

export function useElevenLabsSTT(
  options: UseElevenLabsSTTOptions = {},
): UseElevenLabsSTTResult {
  const onUtteranceRef = useRef(options.onUtterance);
  onUtteranceRef.current = options.onUtterance;
  const silenceTimeout = options.silenceTimeout ?? 1500;
  const accessTokenRef = useRef(options.accessToken);
  accessTokenRef.current = options.accessToken;

  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const sendingRef = useRef(false);

  /** Send accumulated audio chunks to server for transcription */
  const sendAudioForTranscription = useCallback(async () => {
    if (chunksRef.current.length === 0 || sendingRef.current) return;

    sendingRef.current = true;
    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
    chunksRef.current = [];

    // Skip tiny audio clips (likely just noise)
    if (audioBlob.size < 1000) {
      sendingRef.current = false;
      return;
    }

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const sttHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessTokenRef.current) {
        sttHeaders['Authorization'] = `Bearer ${accessTokenRef.current}`;
      }
      const resp = await fetch('/api/elevenlabs/stt', {
        method: 'POST',
        headers: sttHeaders,
        body: JSON.stringify({ audio: base64, encoding: 'base64' }),
      });

      if (!resp.ok) {
        throw new Error(`STT service returned ${resp.status}`);
      }

      const data = await resp.json();
      const text = data.text?.trim();

      if (text) {
        setTranscript(text);
        onUtteranceRef.current?.(text);
      }
    } catch (err) {
      console.warn('[ElevenLabsSTT] Transcription failed:', err instanceof Error ? err.message : err);
      // Don't set error state for transient failures — keep listening
    } finally {
      sendingRef.current = false;
    }
  }, []);

  /** Reset the silence timer — called on each audio chunk to detect pauses */
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      if (activeRef.current) {
        sendAudioForTranscription();
      }
    }, silenceTimeout);
  }, [silenceTimeout, sendAudioForTranscription]);

  const stop = useCallback(() => {
    activeRef.current = false;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Send any remaining audio
    if (chunksRef.current.length > 0) {
      sendAudioForTranscription();
    }

    setIsListening(false);
  }, [sendAudioForTranscription]);

  const start = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];
      activeRef.current = true;

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && activeRef.current) {
          chunksRef.current.push(event.data);
          resetSilenceTimer();
        }
      };

      mediaRecorder.onerror = () => {
        setError('Microphone recording failed');
        stop();
      };

      // Record in 500ms chunks for responsive silence detection
      mediaRecorder.start(500);
      setIsListening(true);

      // Start the initial silence timer
      resetSilenceTimer();
    } catch (err: any) {
      const message = err.name === 'NotAllowedError'
        ? 'Microphone access denied'
        : err.message || 'Failed to start voice input';
      setError(message);
      activeRef.current = false;
      stop();
    }
  }, [stop, resetSilenceTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    transcript,
    isListening,
    start,
    stop,
    error,
  };
}
