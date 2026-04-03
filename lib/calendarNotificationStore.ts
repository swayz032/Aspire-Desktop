/**
 * Calendar Notification Store
 *
 * Listener-based store for calendar event approval and reminder modals.
 *
 * Two modes:
 * 1. APPROVAL — Ava adds a calendar event → user approves or dismisses (YELLOW tier)
 * 2. REMINDER — 30 minutes before a confirmed event → reminder with chime
 *
 * Flow: showCalendarApproval/showCalendarReminder → CalendarNotificationOverlay renders
 *       → user approves/dismisses → callback fires → state resets
 *
 * Production features:
 * - Dismissed event tracking (prevents re-showing dismissed notifications)
 * - Deduplication (same event ID won't trigger duplicate modals)
 * - Approval callback support (callers can await approval result)
 */

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  duration: string;
  location?: string;
  eventType: string;
}

export interface CalendarNotificationState {
  visible: boolean;
  mode: 'approval' | 'reminder' | null;
  event: CalendarEvent | null;
}

type Subscriber = (state: CalendarNotificationState) => void;
type ApprovalCallback = (approved: boolean) => void;

let state: CalendarNotificationState = {
  visible: false,
  mode: null,
  event: null,
};

const subscribers = new Set<Subscriber>();

// Track dismissed event IDs so polling/timers don't re-show them
// Uses a Set with max size to prevent unbounded growth
const dismissedIds = new Set<string>();
const MAX_DISMISSED_IDS = 100;

// Callback for the current approval flow (resolved when user acts)
let pendingApprovalCallback: ApprovalCallback | null = null;

function emit(): void {
  for (const sub of subscribers) {
    sub(state);
  }
}

function trackDismissed(id: string): void {
  if (dismissedIds.size >= MAX_DISMISSED_IDS) {
    const first = dismissedIds.values().next().value;
    if (first) dismissedIds.delete(first);
  }
  dismissedIds.add(id);
}

export function subscribeCalendarNotification(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  subscriber(state);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function getCalendarNotificationState(): CalendarNotificationState {
  return state;
}

/** Check if an event ID was already dismissed */
export function wasEventDismissed(id: string): boolean {
  return dismissedIds.has(id);
}

/**
 * Show calendar approval modal (YELLOW tier — user must confirm).
 * Returns a Promise that resolves to true (approved) or false (dismissed).
 */
export function showCalendarApproval(event: CalendarEvent): Promise<boolean> {
  // Don't re-show dismissed events
  if (dismissedIds.has(event.id)) return Promise.resolve(false);

  // Don't re-show if already displaying this exact event
  if (state.visible && state.event?.id === event.id) return Promise.resolve(false);

  // Cancel any pending approval
  if (pendingApprovalCallback) {
    pendingApprovalCallback(false);
    pendingApprovalCallback = null;
  }

  return new Promise<boolean>((resolve) => {
    pendingApprovalCallback = resolve;
    state = {
      visible: true,
      mode: 'approval',
      event,
    };
    emit();
  });
}

/**
 * Show calendar reminder modal (30-minute pre-event notification).
 */
export function showCalendarReminder(event: CalendarEvent): void {
  // Don't re-show dismissed events
  if (dismissedIds.has(event.id)) return;

  // Don't re-show if already displaying this exact event
  if (state.visible && state.event?.id === event.id) return;

  // Cancel any pending approval flow
  if (pendingApprovalCallback) {
    pendingApprovalCallback(false);
    pendingApprovalCallback = null;
  }

  state = {
    visible: true,
    mode: 'reminder',
    event,
  };
  emit();
}

/**
 * Dismiss (reject) the current calendar notification.
 * For approval mode: resolves the pending promise with false.
 */
export function dismissCalendarNotification(): void {
  if (state.event?.id) {
    trackDismissed(state.event.id);
  }

  // Resolve pending approval as rejected
  if (pendingApprovalCallback) {
    pendingApprovalCallback(false);
    pendingApprovalCallback = null;
  }

  state = {
    visible: false,
    mode: null,
    event: null,
  };
  emit();
}

/**
 * Approve the current calendar event (approval mode only).
 * Resolves the pending promise with true and closes the modal.
 */
export function approveCalendarEvent(): void {
  if (state.event?.id) {
    trackDismissed(state.event.id);
  }

  // Resolve pending approval as accepted
  if (pendingApprovalCallback) {
    pendingApprovalCallback(true);
    pendingApprovalCallback = null;
  }

  state = {
    visible: false,
    mode: null,
    event: null,
  };
  emit();
}
