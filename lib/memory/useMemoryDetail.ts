/**
 * Memory detail hook — placeholder until backend wire-in. Returns
 * `MOCK_MEMORY_DETAIL` for any id during UX iteration.
 */

import type { MemoryDetail } from '@/components/office-memory/types';
import { MOCK_MEMORY_DETAIL } from '@/components/office-memory/fixtures';

export interface UseMemoryDetailResult {
  memory: MemoryDetail | null;
  loading: boolean;
  error: Error | null;
}

export function useMemoryDetail(_memoryId: string | undefined): UseMemoryDetailResult {
  if (!_memoryId) {
    return { memory: null, loading: false, error: null };
  }
  return {
    memory: { ...MOCK_MEMORY_DETAIL, id: _memoryId },
    loading: false,
    error: null,
  };
}
