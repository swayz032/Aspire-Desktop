import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getReceipts } from '@/lib/api';
import { useSupabase } from '@/providers';

export function useRealtimeReceipts(limit = 50) {
  const { suiteId } = useSupabase();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Ref to track if we are mounted to prevent state updates on unmount
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!suiteId) return;
    try {
      setError(null);
      const data = await getReceipts(limit);
      if (mountedRef.current) {
        setReceipts(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load receipts');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [limit, suiteId]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    if (!suiteId) return;

    const channel = supabase
      .channel(`receipts-${suiteId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'receipts',
          filter: `suite_id=eq.${suiteId}` // Law #6: Tenant Isolation
        },
        (payload) => {
          if (mountedRef.current) {
            setReceipts((prev) => [payload.new as any, ...prev].slice(0, limit));
          }
        },
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [limit, refresh, suiteId]);

  return { receipts, loading, error, refresh };
}
