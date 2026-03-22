/**
 * Interaction Telemetry — tracks ALL user interactions across Aspire Desktop.
 *
 * Writes directly to Supabase `client_events` table with batching + rate limiting.
 * Every mic toggle, connect/disconnect, session wizard step, and provider action
 * flows through here → admin portal ClientEvents page shows it in real-time.
 *
 * Architecture: batch queue → flush every 3s or at 15 events → Supabase insert.
 * Best-effort: telemetry NEVER blocks UI or throws user-visible errors.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { buildTraceHeaders } from './traceHeaders';
import { devWarn, devError } from '@/lib/devLog';
import {
  buildFrontendTelemetryContext,
  getFrontendFlightRecorder,
  recordFrontendFlightEvent,
  shouldAttachFlightRecorder,
} from './frontendTelemetryContext';

// ---------------------------------------------------------------------------
// Event Types — exhaustive list of tracked interactions
// ---------------------------------------------------------------------------

export type InteractionEvent =
  // Mic / Voice
  | 'mic_toggle'
  | 'mic_mute'
  | 'mic_unmute'
  | 'speaker_toggle'
  // Agent Connect / Disconnect
  | 'agent_connect'
  | 'agent_disconnect'
  | 'agent_connect_retry'
  | 'agent_mode_switch'
  // Dock
  | 'dock_expand'
  | 'dock_minimize'
  | 'dock_close'
  // Session Wizard
  | 'session_purpose_select'
  | 'session_staff_toggle'
  | 'session_mode_select'
  | 'session_wizard_navigate'
  | 'session_start'
  | 'session_end'
  // Session Menu
  | 'session_menu_open'
  | 'session_menu_select'
  // Provider Connections (Finance)
  | 'provider_connect'
  | 'provider_disconnect'
  | 'provider_crosslink'
  | 'provider_add_bank'
  // Navigation / Page
  | 'page_view'
  | 'page_error'
  // Chat
  | 'chat_mic_toggle'
  | 'chat_send'
  // Generic
  | 'button_press';

export interface InteractionData {
  [key: string]: string | number | boolean | null | undefined;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface QueuedEvent {
  event_type: string;
  source: string;
  severity: string;
  component: string;
  page_route: string;
  data: Record<string, unknown>;
  timestamp: string;
}

const FLUSH_INTERVAL_MS = 3_000;
const FLUSH_THRESHOLD = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 60;

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let eventCountInWindow = 0;
let windowStart = Date.now();
let sessionId: string = '';

// Generate session ID once
function getSessionId(): string {
  if (!sessionId) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      sessionId = crypto.randomUUID();
    } else {
      sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }
  return sessionId;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

function isRateLimited(): boolean {
  const now = Date.now();
  if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
    windowStart = now;
    eventCountInWindow = 0;
  }
  return eventCountInWindow >= MAX_EVENTS_PER_WINDOW;
}

// ---------------------------------------------------------------------------
// Current page route (best-effort)
// ---------------------------------------------------------------------------

function getCurrentRoute(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.pathname || '/';
  }
  return '/unknown';
}

function deriveInteractionSeverity(event: InteractionEvent): string {
  if (event === 'page_error') return 'error';
  if (event === 'agent_connect_retry') return 'warning';
  return 'info';
}

// ---------------------------------------------------------------------------
// Flush — batch insert to Supabase client_events
// ---------------------------------------------------------------------------

async function flushQueue(): Promise<void> {
  if (queue.length === 0) return;

  const batch = queue;
  queue = [];

  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  // Dev mode: log to console (but still flush to Supabase below)
  try {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      for (const evt of batch) {
        // eslint-disable-next-line no-console
        console.debug('[interaction-telemetry]', evt.event_type, evt.component, evt.data);
      }
    }
  } catch {
    // __DEV__ not available, assume production
  }

  // Insert into Supabase client_events (dev + production)
  try {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Auth may not be hydrated yet — retry once after short delay
      await new Promise(r => setTimeout(r, 2000));
      const retry = await supabase.auth.getSession();
      session = retry.data.session;
      if (!session) {
        devWarn('[telemetry] No auth session after retry — dropping', batch.length, 'events');
        return;
      }
    }

    const tenantId = session.user?.user_metadata?.suite_id || session.user?.id || 'unknown';

    const { correlationId } = buildTraceHeaders();
    const rows = batch.map((evt) => ({
      tenant_id: tenantId,
      session_id: getSessionId(),
      event_type: evt.event_type,
      source: 'desktop',
      severity: evt.severity,
      component: evt.component,
      page_route: evt.page_route,
      correlation_id: correlationId,
      data: { ...evt.data, session_id: getSessionId() },
    }));

    await supabase.from('client_events').insert(rows);
  } catch (err) {
    devError('[telemetry] client_events flush failed:', err);
  }
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushQueue().catch(() => { /* silent */ });
  }, FLUSH_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Track a user interaction. Fire-and-forget, never throws.
 *
 * @param event - The interaction event type
 * @param component - Component name (e.g., 'voice-session', 'ava-desk-panel')
 * @param data - Additional context data
 */
export function trackInteraction(
  event: InteractionEvent,
  component: string,
  data: InteractionData = {},
): void {
  if (isRateLimited()) return;
  eventCountInWindow++;

  const pageRoute = getCurrentRoute();
  const context = buildFrontendTelemetryContext({
    source: 'interaction',
    eventType: event,
    component,
    pageRoute,
    data: data as Record<string, unknown>,
  });
  const enrichedData: Record<string, unknown> = {
    ...data,
    release: context.release,
    runtime: context.runtime,
    contract_id: context.contractId,
    flow_id: context.flowId,
    user_agent: context.userAgent,
    page_route: context.pageRoute,
  };
  if (shouldAttachFlightRecorder(event)) {
    enrichedData.flight_recorder = getFrontendFlightRecorder();
  }

  recordFrontendFlightEvent({
    source: 'interaction',
    eventType: event,
    component,
    pageRoute,
    data: enrichedData,
  });

  const entry: QueuedEvent = {
    event_type: event,
    source: 'desktop',
    severity: deriveInteractionSeverity(event),
    component,
    page_route: context.pageRoute,
    data: enrichedData,
    timestamp: new Date().toISOString(),
  };

  queue.push(entry);

  if (queue.length >= FLUSH_THRESHOLD) {
    flushQueue().catch(() => { /* silent */ });
  } else {
    scheduleFlush();
  }
}

/**
 * Force-flush all queued telemetry. Call on page unload / session end.
 */
export function flushInteractionTelemetry(): void {
  flushQueue().catch(() => { /* silent */ });
}
