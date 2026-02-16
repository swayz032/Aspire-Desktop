import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getOutboxJobs } from '@/lib/api';

export function useRealtimeOutbox(limit = 50) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await getOutboxJobs(limit);
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outbox jobs');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('outbox-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outbox_jobs' },
        () => {
          refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, refresh]);

  return { jobs, loading, error, refresh };
}
