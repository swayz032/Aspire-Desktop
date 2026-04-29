/**
 * Office Memory — type contracts shared by every Memory Engine component.
 *
 * These map 1:1 to the Coordination Spine `MemoryObject` schema (plan §3 + §5)
 * but only expose the fields the UI actually renders. Backend is the source of
 * truth; these types are the front-end's read shape.
 *
 * MEMORY_TYPE_COLORS is a curated 7-color palette (Aspire visual language —
 * one accent for interactive blue, plus 6 type discriminators). Never extend
 * with freeform colors — add a new MemoryType + map entry instead.
 */

import type { ColorValue } from 'react-native';

// ---------------------------------------------------------------------------
// Discriminators
// ---------------------------------------------------------------------------

export type MemoryType =
  | 'meeting'
  | 'call'
  | 'note'
  | 'document'
  | 'contract'
  | 'invoice'
  | 'quote'
  | 'strategy'
  | 'research'
  | 'task'
  | 'summary';

export type MemoryStatus =
  | 'requested'
  | 'drafted'
  | 'pending_approval'
  | 'approved'
  | 'executed'
  | 'rejected'
  | 'superseded'
  | 'failed'
  | 'promoted';

export type MemoryViewMode = 'grid' | 'list';

export type MemorySortKey = 'recent' | 'oldest' | 'relevance';

// ---------------------------------------------------------------------------
// Linked entities
// ---------------------------------------------------------------------------

export interface MemoryEntityRef {
  id: string;
  name: string;
  /** Optional avatar/icon URI */
  avatarUrl?: string;
}

export interface MemoryProjectRef {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Linked facts (detail page sub-tile)
// ---------------------------------------------------------------------------

export type LinkedFactKind =
  | 'proposal'
  | 'project_update'
  | 'site_walk'
  | 'meeting'
  | 'invoice'
  | 'contract'
  | 'document'
  | 'add_link';

export interface LinkedFact {
  id: string;
  kind: LinkedFactKind;
  label: string;
  date?: string;
  href?: string;
}

// ---------------------------------------------------------------------------
// Activity files (detail page bottom row)
// ---------------------------------------------------------------------------

export type ActivityFileKind = 'audio' | 'video' | 'pdf' | 'doc' | 'zip' | 'image';

export interface ActivityFile {
  id: string;
  kind: ActivityFileKind;
  label: string;
  /** e.g., "MP4 · 19 MB" */
  meta: string;
  href?: string;
}

// ---------------------------------------------------------------------------
// Key decisions (detail page checklist)
// ---------------------------------------------------------------------------

export interface KeyDecision {
  id: string;
  label: string;
  /** V1 read-only — toggle reserved for V2 */
  checked: boolean;
}

// ---------------------------------------------------------------------------
// Memory summary — used by results grid card
// ---------------------------------------------------------------------------

export interface MemorySummary {
  id: string;
  type: MemoryType;
  title: string;
  /** 3-line clamp on card */
  summary: string;
  entity?: MemoryEntityRef;
  project?: MemoryProjectRef;
  /** ISO 8601 string; rendered as relative date or absolute MMM D, YYYY */
  date: string;
  tags: string[];
  bookmarked?: boolean;
  status?: MemoryStatus;
}

// ---------------------------------------------------------------------------
// Memory detail — used by detail page
// ---------------------------------------------------------------------------

export interface MemoryDetail extends MemorySummary {
  /** Human duration like "45 min" */
  duration?: string;
  participants: string[];
  location?: string;
  createdBy: string;
  keyDecisions: KeyDecision[];
  linkedFacts: LinkedFact[];
  activityFiles: ActivityFile[];
  /** Raw transcript / long-form content — secondary surface */
  rawContent?: string;
}

// ---------------------------------------------------------------------------
// Filters (URL query state)
// ---------------------------------------------------------------------------

export interface MemoryFilters {
  q?: string;
  type?: MemoryType;
  dateRange?: 'last_7d' | 'last_30d' | 'last_90d' | 'custom';
  customDateStart?: string;
  customDateEnd?: string;
  entityId?: string;
  tags?: string[];
  sort?: MemorySortKey;
  page?: number;
}

// ---------------------------------------------------------------------------
// Curated type palette (Aspire visual language)
// ---------------------------------------------------------------------------

export interface MemoryTypeStyle {
  /** Badge background tint (low-opacity) */
  tintBg: ColorValue;
  /** Badge text + accent */
  tintFg: ColorValue;
  /** Display label */
  label: string;
}

export const MEMORY_TYPE_COLORS: Record<MemoryType, MemoryTypeStyle> = {
  meeting:    { tintBg: 'rgba(59, 130, 246, 0.18)',  tintFg: '#60A5FA', label: 'Meeting' },
  call:       { tintBg: 'rgba(244, 63, 94, 0.18)',   tintFg: '#FB7185', label: 'Call' },
  note:       { tintBg: 'rgba(161, 161, 170, 0.18)', tintFg: '#D4D4D8', label: 'Note' },
  document:   { tintBg: 'rgba(244, 114, 182, 0.18)', tintFg: '#F472B6', label: 'Document' },
  contract:   { tintBg: 'rgba(245, 158, 11, 0.18)',  tintFg: '#FBBF24', label: 'Contract' },
  invoice:    { tintBg: 'rgba(16, 185, 129, 0.18)',  tintFg: '#34D399', label: 'Invoice' },
  quote:      { tintBg: 'rgba(45, 212, 191, 0.18)',  tintFg: '#5EEAD4', label: 'Quote' },
  strategy:   { tintBg: 'rgba(168, 85, 247, 0.18)',  tintFg: '#C084FC', label: 'Strategy' },
  research:   { tintBg: 'rgba(34, 211, 238, 0.18)',  tintFg: '#67E8F9', label: 'Research' },
  task:       { tintBg: 'rgba(99, 102, 241, 0.18)',  tintFg: '#818CF8', label: 'Task' },
  summary:    { tintBg: 'rgba(148, 163, 184, 0.18)', tintFg: '#CBD5E1', label: 'Summary' },
};

// ---------------------------------------------------------------------------
// Search response shape (matches /v1/office-memory/search-memory)
// ---------------------------------------------------------------------------

export interface MemorySearchResponse {
  items: MemorySummary[];
  total: number;
  page: number;
  pageSize: number;
  /** Cursor for next page; null if last page */
  nextCursor: string | null;
}

export const MEMORY_PAGE_SIZE = 9; // 3x3 grid per plan §8 — locked
