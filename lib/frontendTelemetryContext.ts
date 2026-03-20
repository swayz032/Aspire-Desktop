import { Platform } from 'react-native';

interface TelemetryContextInput {
  source: 'interaction' | 'canvas';
  eventType: string;
  component: string;
  pageRoute?: string;
  data?: Record<string, unknown>;
}

interface FlightRecorderEntry {
  source: 'interaction' | 'canvas';
  event_type: string;
  component: string;
  page_route: string;
  created_at: string;
  release: string;
}

const FLIGHT_RECORDER_LIMIT = 20;
let flightRecorder: FlightRecorderEntry[] = [];

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getFrontendRelease(): string {
  return (
    process.env.EXPO_PUBLIC_ASPIRE_RELEASE ||
    process.env.ASPIRE_RELEASE ||
    process.env.EXPO_PUBLIC_APP_VERSION ||
    'aspire-desktop@1.0.0'
  );
}

export function getFrontendRuntime(): string {
  return Platform.OS === 'web' ? 'web' : Platform.OS;
}

function currentRoute(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.pathname || '/';
  }
  return '/unknown';
}

function currentUserAgent(): string | null {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    return navigator.userAgent || null;
  }
  return null;
}

export function inferFrontendContract({
  eventType,
  component,
  pageRoute,
  data,
}: Omit<TelemetryContextInput, 'source'>): string | null {
  const route = (pageRoute || currentRoute()).toLowerCase();
  const normalizedComponent = component.toLowerCase();
  const normalizedEvent = eventType.toLowerCase();
  const explicit = readString(data?.contract_id);
  if (explicit) return explicit;

  if (route === '/login' || route.startsWith('/auth') || normalizedComponent.includes('auth') || normalizedComponent.includes('login')) {
    return 'auth.login';
  }
  if (route.startsWith('/session/conference')) return 'session.conference';
  if (route.startsWith('/session/voice') || route.startsWith('/session/start') || normalizedEvent.startsWith('session_') || normalizedEvent.startsWith('mic_')) {
    return 'session.voice';
  }
  if (route.startsWith('/finance-hub/connections') || normalizedEvent.startsWith('provider_')) {
    return 'finance.connections';
  }
  if (route.startsWith('/finance-hub') || normalizedComponent.includes('finn') || normalizedComponent.includes('finance')) {
    return 'finn.finance';
  }
  if (normalizedEvent.startsWith('canvas.') || normalizedComponent.includes('canvas')) {
    return 'canvas.workspace';
  }
  if (
    normalizedComponent.includes('ava') ||
    normalizedComponent.includes('dock') ||
    normalizedEvent.startsWith('agent_') ||
    normalizedEvent === 'chat_send'
  ) {
    return 'ava.voice';
  }
  if (route === '/' || route.startsWith('/home')) {
    return 'desktop.home';
  }
  return null;
}

export function buildFrontendTelemetryContext(input: TelemetryContextInput) {
  const pageRoute = input.pageRoute || currentRoute();
  const release = getFrontendRelease();
  const runtime = getFrontendRuntime();
  const contractId = inferFrontendContract({
    eventType: input.eventType,
    component: input.component,
    pageRoute,
    data: input.data,
  });
  const flowId = readString(input.data?.flow_id) ?? contractId;

  return {
    pageRoute,
    release,
    runtime,
    contractId,
    flowId,
    userAgent: currentUserAgent(),
  };
}

export function recordFrontendFlightEvent(input: TelemetryContextInput): void {
  const context = buildFrontendTelemetryContext(input);
  flightRecorder = [
    ...flightRecorder,
    {
      source: input.source,
      event_type: input.eventType,
      component: input.component,
      page_route: context.pageRoute,
      created_at: new Date().toISOString(),
      release: context.release,
    },
  ].slice(-FLIGHT_RECORDER_LIMIT);
}

export function getFrontendFlightRecorder(limit = 12): FlightRecorderEntry[] {
  return flightRecorder.slice(-limit);
}

export function shouldAttachFlightRecorder(eventType: string): boolean {
  return [
    'page_error',
    'agent_connect_retry',
    'canvas.error',
    'canvas.slo_violation',
    'canvas.fallback_trigger',
  ].includes(eventType);
}
