import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getReceipts } from '@/lib/api';

/** Receipt row shape from Supabase receipts table. */
export interface ReceiptRow {
  id: string;
  suite_id: string;
  agent: string;
  action: string;
  status: string;
  risk_tier: string;
  created_at: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export function useRealtimeReceipts(limit = 50) {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await getReceipts(limit);
      setReceipts(data as ReceiptRow[]);
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
          setReceipts((prev) => [payload.new as ReceiptRow, ...prev].slice(0, limit));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, refresh]);

  return { receipts, loading, error, refresh };
}
