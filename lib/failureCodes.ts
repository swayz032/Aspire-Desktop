// ---------------------------------------------------------------------------
// Failure Code Registry — F-001 through F-020
// Governance-aware error handling for Canvas Mode.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FailureSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface FailureCode {
  code: string;
  severity: FailureSeverity;
  userMessage: string; // Human-friendly, shown in UI
  internalMessage: string; // Technical, for logs/telemetry
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const FAILURE_CODES: Record<string, FailureCode> = {
  'F-001': {
    code: 'F-001',
    severity: 'error',
    userMessage: 'Connection issue. Please try again.',
    internalMessage: 'NETWORK_ERROR: Fetch or WebSocket failure',
    retryable: true,
  },
  'F-002': {
    code: 'F-002',
    severity: 'warning',
    userMessage: 'This is taking longer than expected.',
    internalMessage: 'TIMEOUT: Operation exceeded deadline',
    retryable: true,
  },
  'F-003': {
    code: 'F-003',
    severity: 'error',
    userMessage: 'Your session has expired. Please sign in again.',
    internalMessage: 'AUTH_EXPIRED: JWT or session token expired',
    retryable: false,
  },
  'F-004': {
    code: 'F-004',
    severity: 'error',
    userMessage: 'Authentication required.',
    internalMessage: 'AUTH_MISSING: No auth token provided',
    retryable: false,
  },
  'F-005': {
    code: 'F-005',
    severity: 'warning',
    userMessage: "This action was denied by your organization's policy.",
    internalMessage: 'GOVERNANCE_DENIED: Policy engine rejected the request',
    retryable: false,
  },
  'F-006': {
    code: 'F-006',
    severity: 'error',
    userMessage: 'Authorization expired. Requesting new authorization.',
    internalMessage: 'CAPABILITY_TOKEN_EXPIRED: Token past expiry (<60s TTL)',
    retryable: true,
  },
  'F-007': {
    code: 'F-007',
    severity: 'error',
    userMessage: 'Invalid authorization. Please try again.',
    internalMessage: 'CAPABILITY_TOKEN_INVALID: Signature verification failed',
    retryable: false,
  },
  'F-008': {
    code: 'F-008',
    severity: 'error',
    userMessage: 'This action is not available.',
    internalMessage: 'MANIFEST_MISS: Tile/verb not in manifest (deny-by-default)',
    retryable: false,
  },
  'F-009': {
    code: 'F-009',
    severity: 'error',
    userMessage: 'This item could not be found.',
    internalMessage: 'TILE_NOT_FOUND: Referenced tile ID does not exist',
    retryable: false,
  },
  'F-010': {
    code: 'F-010',
    severity: 'info',
    userMessage: 'Performance adjusted for smoother experience.',
    internalMessage: 'FPS_DEGRADATION: Fallback engine triggered mode downgrade',
    retryable: false,
  },
  'F-011': {
    code: 'F-011',
    severity: 'info',
    userMessage: 'Sound effects unavailable.',
    internalMessage: 'SOUND_INIT_FAILURE: Audio context or asset load failed',
    retryable: false,
  },
  'F-012': {
    code: 'F-012',
    severity: 'error',
    userMessage: 'Unable to open workspace. Please try again.',
    internalMessage: 'STAGE_OPEN_FAILURE: Stage component mount or data load failed',
    retryable: true,
  },
  'F-013': {
    code: 'F-013',
    severity: 'error',
    userMessage: 'Invalid operation for current state.',
    internalMessage: 'RUNWAY_INVALID_TRANSITION: State machine rejected event',
    retryable: false,
  },
  'F-014': {
    code: 'F-014',
    severity: 'warning',
    userMessage: 'Preview unavailable. You can still proceed.',
    internalMessage: 'DRY_RUN_FAILURE: Dry-run simulation returned error',
    retryable: true,
  },
  'F-015': {
    code: 'F-015',
    severity: 'info',
    userMessage: '', // silent — no user message for telemetry failures
    internalMessage: 'TELEMETRY_FLUSH_FAILURE: POST to telemetry endpoint failed',
    retryable: false,
  },
  'F-016': {
    code: 'F-016',
    severity: 'warning',
    userMessage: 'Preview took too long to load.',
    internalMessage: 'LENS_RENDER_TIMEOUT: LiveLens render exceeded deadline',
    retryable: false,
  },
  'F-017': {
    code: 'F-017',
    severity: 'warning',
    userMessage: 'Search is temporarily unavailable.',
    internalMessage: 'PALETTE_SEARCH_FAILURE: CommandPalette search query failed',
    retryable: true,
  },
  'F-018': {
    code: 'F-018',
    severity: 'critical',
    userMessage: 'Access denied.',
    internalMessage: 'CROSS_TENANT_BLOCKED: RLS or suite_id mismatch detected',
    retryable: false,
  },
  'F-019': {
    code: 'F-019',
    severity: 'critical',
    userMessage: 'Data handling error. Please contact support.',
    internalMessage: 'PII_DETECTED: PII found in payload destined for telemetry or logs',
    retryable: false,
  },
  'F-020': {
    code: 'F-020',
    severity: 'error',
    userMessage: 'Something went wrong. Please try again.',
    internalMessage: 'UNKNOWN: Unclassified error',
    retryable: true,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the failure code entry or null. Unknown code = null (deny-by-default).
 */
export function getFailureCode(code: string): FailureCode | null {
  if (!Object.prototype.hasOwnProperty.call(FAILURE_CODES, code)) return null;
  return FAILURE_CODES[code] ?? null;
}

/**
 * Returns all registered failure codes.
 */
export function getAllFailureCodes(): FailureCode[] {
  return Object.values(FAILURE_CODES);
}
