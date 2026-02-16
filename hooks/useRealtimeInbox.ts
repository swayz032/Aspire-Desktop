import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getInboxItems } from '@/lib/api';

export function useRealtimeInbox(limit = 50) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await getInboxItems(limit);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox items');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('inbox-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inbox_items' },
        () => {
          refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, refresh]);

  return { items, loading, error, refresh };
}
