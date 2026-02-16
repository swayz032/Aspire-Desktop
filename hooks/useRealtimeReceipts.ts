import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getReceipts } from '@/lib/api';

export function useRealtimeReceipts(limit = 50) {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await getReceipts(limit);
      setReceipts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('receipts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'receipts' },
        (payload) => {
          setReceipts((prev) => [payload.new as any, ...prev].slice(0, limit));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, refresh]);

  return { receipts, loading, error, refresh };
}
