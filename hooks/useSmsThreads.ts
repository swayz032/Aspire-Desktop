import { useState, useEffect, useCallback, useRef } from 'react';
import type { SmsThread, SmsMessage } from '@/types/frontdesk';

interface UseSmsThreadsOptions {
  pollInterval?: number;
  limit?: number;
}

/**
 * Hook to fetch SMS threads from enterprise frontdesk_sms_threads table.
 */
export function useSmsThreads(options: UseSmsThreadsOptions = {}) {
  const { pollInterval = 5000, limit = 50 } = options;
  const [threads, setThreads] = useState<SmsThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages/threads?limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setThreads(data.threads || []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchThreads();
    intervalRef.current = setInterval(fetchThreads, pollInterval);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchThreads, pollInterval]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchThreads();
  }, [fetchThreads]);

  return { threads, loading, error, refresh };
}

/**
 * Hook to fetch messages for a specific SMS thread.
 */
export function useSmsMessages(threadId: string | null, options: { pollInterval?: number } = {}) {
  const { pollInterval = 5000 } = options;
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!threadId) return;
    try {
      const res = await fetch(`/api/messages/threads/${threadId}/messages?limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    fetchMessages();
    intervalRef.current = setInterval(fetchMessages, pollInterval);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchMessages, pollInterval, threadId]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchMessages();
  }, [fetchMessages]);

  return { messages, loading, error, refresh };
}
