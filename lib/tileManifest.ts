// ---------------------------------------------------------------------------
// Tile Manifest — deny-by-default registry (Law #3: Fail Closed)
// Unknown tile ID → null. Unknown verb → empty array. No exceptions.
// Spec: Canvas Mode Appendix B — tiles map to homepage sections.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TileLensField {
  key: string;
  label: string;
  type: 'text' | 'currency' | 'date' | 'status' | 'email';
}

export interface TileVerb {
  id: string;
  label: string;
  riskTier: 'green' | 'yellow' | 'red';
  lensFields: TileLensField[];
}

export interface TileEntry {
  id: string;
  desk: string;
  label: string;
  icon: string; // Ionicons glyph name
  verbs: TileVerb[];
  defaultVerb: string; // verb id
}

// ---------------------------------------------------------------------------
// Static v2 manifest — 6 tiles mapped to homepage sections (Appendix B)
// ---------------------------------------------------------------------------

const TILES: readonly TileEntry[] = [
  {
    id: 'conference_call',
    desk: 'sarah',
    label: 'Conference Call',
    icon: 'people-outline',
    defaultVerb: 'start_conference',
    verbs: [
      {
        id: 'start_conference',
        label: 'Start Conference',
        riskTier: 'yellow',
        lensFields: [
          { key: 'last_receipt', label: 'Last Receipt', type: 'text' },
          { key: 'authority_count', label: 'Pending Approvals', type: 'text' },
          { key: 'setup_status', label: 'Setup Status', type: 'status' },
        ],
      },
      {
        id: 'draft_agenda',
        label: 'Draft Agenda',
        riskTier: 'green',
        lensFields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'attendees', label: 'Attendees', type: 'text' },
        ],
      },
      {
        id: 'invite_attendees',
        label: 'Invite Attendees',
        riskTier: 'yellow',
        lensFields: [
          { key: 'attendees', label: 'Attendees', type: 'text' },
          { key: 'meeting_time', label: 'Time', type: 'date' },
        ],
      },
    ],
  },
  {
    id: 'return_calls',
    desk: 'sarah',
    label: 'Return Calls',
    icon: 'call-outline',
    defaultVerb: 'draft_callback_plan',
    verbs: [
      {
        id: 'draft_callback_plan',
        label: 'Draft Callback Plan',
        riskTier: 'green',
        lensFields: [
          { key: 'last_receipt', label: 'Last Receipt', type: 'text' },
          { key: 'authority_count', label: 'Pending Approvals', type: 'text' },
          { key: 'phone_setup', label: 'Phone Setup', type: 'status' },
        ],
      },
      {
        id: 'request_approval',
        label: 'Request Approval',
        riskTier: 'yellow',
        lensFields: [
          { key: 'callback_to', label: 'Call To', type: 'text' },
          { key: 'reason', label: 'Reason', type: 'text' },
        ],
      },
      {
        id: 'start_call',
        label: 'Start Call',
        riskTier: 'yellow',
        lensFields: [
          { key: 'recipient', label: 'Recipient', type: 'text' },
          { key: 'phone', label: 'Phone', type: 'text' },
        ],
      },
    ],
  },
  {
    id: 'finance_hub',
    desk: 'finn',
    label: 'Finance Hub',
    icon: 'wallet-outline',
    defaultVerb: 'draft_cash_report',
    verbs: [
      {
        id: 'draft_cash_report',
        label: 'Draft Cash Report',
        riskTier: 'green',
        lensFields: [
          { key: 'last_receipt', label: 'Last Receipt', type: 'text' },
          { key: 'authority_count', label: 'Pending Approvals', type: 'text' },
          { key: 'connection_health', label: 'Connections', type: 'status' },
        ],
      },
      {
        id: 'connect_accounts',
        label: 'Connect Accounts',
        riskTier: 'yellow',
        lensFields: [
          { key: 'provider', label: 'Provider', type: 'text' },
          { key: 'status', label: 'Status', type: 'status' },
        ],
      },
      {
        id: 'draft_forecast',
        label: 'Draft Forecast',
        riskTier: 'yellow',
        lensFields: [
          { key: 'period', label: 'Period', type: 'text' },
          { key: 'confidence', label: 'Confidence', type: 'text' },
        ],
      },
    ],
  },
  {
    id: 'inbox_setup',
    desk: 'eli',
    label: 'Inbox Setup',
    icon: 'mail-outline',
    defaultVerb: 'start_setup',
    verbs: [
      {
        id: 'start_setup',
        label: 'Start Setup',
        riskTier: 'yellow',
        lensFields: [
          { key: 'setup_status', label: 'Setup Status', type: 'status' },
          { key: 'last_receipt', label: 'Last Receipt', type: 'text' },
          { key: 'authority_count', label: 'Pending Approvals', type: 'text' },
        ],
      },
      {
        id: 'verify_dns',
        label: 'Verify DNS',
        riskTier: 'green',
        lensFields: [
          { key: 'domain', label: 'Domain', type: 'text' },
          { key: 'status', label: 'DNS Status', type: 'status' },
        ],
      },
      {
        id: 'draft_welcome_email',
        label: 'Draft Welcome Email',
        riskTier: 'yellow',
        lensFields: [
          { key: 'template', label: 'Template', type: 'text' },
          { key: 'to', label: 'To', type: 'email' },
        ],
      },
    ],
  },
  {
    id: 'calendar',
    desk: 'nora',
    label: 'Calendar',
    icon: 'calendar-outline',
    defaultVerb: 'create_event',
    verbs: [
      {
        id: 'create_event',
        label: 'Create Event',
        riskTier: 'yellow',
        lensFields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'attendees', label: 'Attendees', type: 'text' },
        ],
      },
      {
        id: 'view',
        label: 'View Calendar',
        riskTier: 'green',
        lensFields: [
          { key: 'date_range', label: 'Date Range', type: 'text' },
        ],
      },
    ],
  },
  {
    id: 'authority_queue',
    desk: 'quinn',
    label: 'Authority Queue',
    icon: 'shield-checkmark-outline',
    defaultVerb: 'review',
    verbs: [
      {
        id: 'review',
        label: 'Review Queue',
        riskTier: 'green',
        lensFields: [
          { key: 'item_count', label: 'Items', type: 'text' },
          { key: 'priority', label: 'Priority', type: 'status' },
        ],
      },
      {
        id: 'approve',
        label: 'Approve Item',
        riskTier: 'yellow',
        lensFields: [
          { key: 'item', label: 'Item', type: 'text' },
          { key: 'risk_tier', label: 'Risk Tier', type: 'status' },
        ],
      },
      {
        id: 'deny',
        label: 'Deny Item',
        riskTier: 'yellow',
        lensFields: [
          { key: 'item', label: 'Item', type: 'text' },
          { key: 'reason', label: 'Reason', type: 'text' },
        ],
      },
    ],
  },
] as const satisfies readonly TileEntry[];

// ---------------------------------------------------------------------------
// Index for O(1) lookup
// ---------------------------------------------------------------------------

const tileIndex = new Map<string, TileEntry>();
for (const tile of TILES) {
  tileIndex.set(tile.id, tile);
}

// ---------------------------------------------------------------------------
// Public API — deny-by-default
// ---------------------------------------------------------------------------

/**
 * Returns the tile entry or null. Unknown ID = null (deny-by-default).
 */
export function getTile(id: string): TileEntry | null {
  return tileIndex.get(id) ?? null;
}

/**
 * Returns all registered tiles.
 */
export function getAllTiles(): TileEntry[] {
  return [...TILES];
}

/**
 * Returns verbs for a tile. Unknown tile = empty array.
 */
export function getTileVerbs(tileId: string): TileVerb[] {
  const tile = tileIndex.get(tileId);
  return tile ? [...tile.verbs] : [];
}

/**
 * Case-insensitive substring search across tile labels and verb labels.
 * Used by CommandPalette for fuzzy matching.
 */
export function searchVerbs(
  query: string,
): Array<{ tile: TileEntry; verb: TileVerb }> {
  if (!query) return [];

  const lower = query.toLowerCase();
  const results: Array<{ tile: TileEntry; verb: TileVerb }> = [];

  for (const tile of TILES) {
    const tileMatches = tile.label.toLowerCase().includes(lower);

    for (const verb of tile.verbs) {
      if (tileMatches || verb.label.toLowerCase().includes(lower)) {
        results.push({ tile, verb });
      }
    }
  }

  return results;
}
