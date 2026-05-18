/**
 * Service Memory API client — shared helpers.
 *
 * Mirror of `lib/api/officeMemory.ts` (Pass 17) wired to the Service Hub
 * memory routes at `/api/v1/service-memory/*`. The Express proxy mints the
 * capability token + injects Gateway-trusted scope headers
 * (`X-Tenant-Id`, `X-Suite-Id`, `X-Office-Id`) before forwarding to the
 * Python orchestrator (`routes/service_memory.py`).
 *
 * Backend response shapes are identical to Office Memory's `MemoryObjectOut`
 * — Service Memory is the same spine viewed through the service-hub lens —
 * so we reuse the office-memory backend object + mapper contracts.
 *
 * Law compliance:
 *   Law #5 — capability tokens minted server-side, never exposed to client.
 *   Law #6 — scope headers injected from JWT, not from client input.
 *   Law #9 — error messages do not leak backend internals.
 */

import {
  API_BASE,
  MemoryApiError,
  mapMemoryDetail,
  mapMemorySummary,
  type BackendMemoryObject,
  type BackendSearchResponse,
  type BackendThreadMemoryResponse,
} from '@/lib/api/officeMemory';

// Re-export the shared types so consumers can `import from '@/lib/api/serviceMemory'`
// without reaching back into the office-memory client.
export {
  API_BASE,
  MemoryApiError,
  mapMemoryDetail,
  mapMemorySummary,
  type BackendMemoryObject,
  type BackendSearchResponse,
  type BackendThreadMemoryResponse,
};

// ---------------------------------------------------------------------------
// Route constants — same-origin proxy paths.
// ---------------------------------------------------------------------------

export const SERVICE_MEMORY_SEARCH_PATH = '/api/v1/service-memory/search-memory';
export const SERVICE_MEMORY_DETAIL_PATH = (memoryId: string): string =>
  `/api/v1/service-memory/${encodeURIComponent(memoryId)}`;
export const SERVICE_MEMORY_BRIEF_PATH = '/api/v1/service-memory/get-memory-brief';
export const SERVICE_MEMORY_THREAD_PATH = '/api/v1/service-memory/get-thread-memory';
export const SERVICE_MEMORY_HANDOFF_PATH = '/api/v1/service-memory/create-handoff-note';
export const SERVICE_MEMORY_SUMMARY_PATH = '/api/v1/service-memory/save-session-summary';
export const SERVICE_MEMORY_PROMOTE_PATH = '/api/v1/service-memory/promote-artifact';
