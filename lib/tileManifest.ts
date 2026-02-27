// ---------------------------------------------------------------------------
// Tile Manifest — deny-by-default registry (Law #3: Fail Closed)
// Unknown tile ID → null. Unknown verb → empty array. No exceptions.
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
// Static v1 manifest — 6 tiles
// ---------------------------------------------------------------------------

const TILES: readonly TileEntry[] = [
  {
    id: 'invoice',
    desk: 'quinn',
    label: 'Invoice',
    icon: 'receipt-outline',
    defaultVerb: 'create',
    verbs: [
      {
        id: 'create',
        label: 'Create Invoice',
        riskTier: 'yellow',
        lensFields: [
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'client', label: 'Client', type: 'text' },
          { key: 'description', label: 'Description', type: 'text' },
          { key: 'due_date', label: 'Due Date', type: 'date' },
        ],
      },
      {
        id: 'send',
        label: 'Send Invoice',
        riskTier: 'yellow',
        lensFields: [
          { key: 'recipient', label: 'Recipient', type: 'email' },
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'status', label: 'Status', type: 'status' },
        ],
      },
      {
        id: 'void',
        label: 'Void Invoice',
        riskTier: 'red',
        lensFields: [
          { key: 'invoice_id', label: 'Invoice ID', type: 'text' },
          { key: 'reason', label: 'Reason', type: 'text' },
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
    id: 'email',
    desk: 'eli',
    label: 'Email',
    icon: 'mail-outline',
    defaultVerb: 'compose',
    verbs: [
      {
        id: 'compose',
        label: 'Compose Email',
        riskTier: 'yellow',
        lensFields: [
          { key: 'to', label: 'To', type: 'email' },
          { key: 'subject', label: 'Subject', type: 'text' },
          { key: 'body', label: 'Body', type: 'text' },
        ],
      },
      {
        id: 'view',
        label: 'View Inbox',
        riskTier: 'green',
        lensFields: [
          { key: 'folder', label: 'Folder', type: 'text' },
        ],
      },
    ],
  },
  {
    id: 'contract',
    desk: 'clara',
    label: 'Contract',
    icon: 'document-text-outline',
    defaultVerb: 'create',
    verbs: [
      {
        id: 'create',
        label: 'Create Contract',
        riskTier: 'yellow',
        lensFields: [
          { key: 'template', label: 'Template', type: 'text' },
          { key: 'client', label: 'Client', type: 'text' },
          { key: 'value', label: 'Contract Value', type: 'currency' },
        ],
      },
      {
        id: 'send_for_signature',
        label: 'Send for Signature',
        riskTier: 'red',
        lensFields: [
          { key: 'signer', label: 'Signer', type: 'text' },
          { key: 'signer_email', label: 'Signer Email', type: 'email' },
          { key: 'document', label: 'Document', type: 'text' },
        ],
      },
      {
        id: 'view',
        label: 'View Contracts',
        riskTier: 'green',
        lensFields: [
          { key: 'status', label: 'Status', type: 'status' },
        ],
      },
    ],
  },
  {
    id: 'payment',
    desk: 'finn',
    label: 'Payment',
    icon: 'card-outline',
    defaultVerb: 'send',
    verbs: [
      {
        id: 'send',
        label: 'Send Payment',
        riskTier: 'red',
        lensFields: [
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'recipient', label: 'Recipient', type: 'text' },
          { key: 'description', label: 'Description', type: 'text' },
        ],
      },
      {
        id: 'request',
        label: 'Request Payment',
        riskTier: 'yellow',
        lensFields: [
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'from', label: 'From', type: 'text' },
          { key: 'due_date', label: 'Due Date', type: 'date' },
        ],
      },
    ],
  },
  {
    id: 'document',
    desk: 'tec',
    label: 'Document',
    icon: 'folder-outline',
    defaultVerb: 'generate',
    verbs: [
      {
        id: 'generate',
        label: 'Generate Document',
        riskTier: 'yellow',
        lensFields: [
          { key: 'type', label: 'Document Type', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'format', label: 'Format', type: 'text' },
        ],
      },
      {
        id: 'view',
        label: 'View Documents',
        riskTier: 'green',
        lensFields: [
          { key: 'category', label: 'Category', type: 'text' },
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
