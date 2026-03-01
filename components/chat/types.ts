/**
 * Unified Chat Types
 *
 * Shared type definitions consumed by all 6 chat components:
 * AvaDeskPanel, FinnDeskPanel, FinnVideoChatOverlay, FinnChatModal,
 * EliVoiceChatPanel, ConferenceChatDrawer.
 *
 * Merges duplicated types from each component into a single source of truth.
 */

import type { Ionicons } from '@expo/vector-icons';

// ---------------------------------------------------------------------------
// Agent Identity
// ---------------------------------------------------------------------------

/**
 * Union of all Aspire agent identifiers.
 * Matches the AGENT_VOICES registry in lib/elevenlabs.ts plus
 * the full roster defined in CLAUDE.md.
 */
export type AgentId =
  | 'ava'
  | 'finn'
  | 'eli'
  | 'nora'
  | 'sarah'
  | 'quinn'
  | 'adam'
  | 'tec'
  | 'milo'
  | 'teressa'
  | 'clara';

/**
 * Canonical agent accent colors for chat UI theming.
 * Sourced from Canvas.halo.desk tokens + existing component hardcodes.
 */
export const AGENT_COLORS: Record<AgentId, string> = {
  ava: '#3B82F6',     // Aspire blue
  finn: '#10B981',    // green (chat/canvas) — note: FinnDeskPanel uses #3B82F6 (blue) in some places
  eli: '#F59E0B',     // amber
  nora: '#0891B2',    // teal
  sarah: '#9382F6',   // lavender
  quinn: '#3B82F6',   // blue
  adam: '#14B8A6',    // teal-green
  tec: '#6366F1',     // indigo
  milo: '#EC4899',    // pink
  teressa: '#8B5CF6', // violet
  clara: '#EF4444',   // red
} as const;

// ---------------------------------------------------------------------------
// File Attachments
// ---------------------------------------------------------------------------

/** File attachment on a chat message. */
export interface FileAttachment {
  id: string;
  name: string;
  /** File format hint for icon selection. */
  kind: 'PDF' | 'DOCX' | 'XLSX' | 'PNG' | 'CSV' | 'TXT' | string;
  url?: string;
  /** File size in bytes (optional — used for display). */
  size?: number;
}

/** Inline media item returned by orchestrator/model (e.g. web image result). */
export interface ChatMediaItem {
  type: 'image';
  url: string;
  alt?: string;
  source?: string;
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// Activity Events
// ---------------------------------------------------------------------------

/**
 * A single step in the orchestrator execution pipeline.
 * Displayed in the ActivityTimeline component alongside chat messages.
 */
export interface AgentActivityEvent {
  /** Unique ID for React key and deduplication. */
  id: string;
  /** Pipeline step category. */
  type: 'thinking' | 'step' | 'tool_call' | 'done' | 'error';
  /** Human-readable description of the step. */
  label: string;
  /** Completion status for timeline rendering. */
  status: 'pending' | 'active' | 'completed' | 'error';
  /** Epoch timestamp (ms). */
  timestamp: number;
  /** Optional Ionicons icon name override. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Optional structured details (tool name, receipt ID, etc.). */
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Active Run
// ---------------------------------------------------------------------------

/**
 * Tracks the state of an in-progress orchestrator invocation.
 * A chat message with a `runId` is associated with the corresponding ActiveRun.
 */
export interface ActiveRun {
  /** Unique run identifier (typically `run_${Date.now()}`). */
  runId: string;
  /** Which agent is executing this run. */
  agent: AgentId;
  /** Current run lifecycle state. */
  status: 'running' | 'completed' | 'error';
  /** Epoch timestamp when the run started. */
  startedAt: number;
  /** Accumulated pipeline activity events. */
  events: AgentActivityEvent[];
  /** Final response text (populated when status is 'completed'). */
  finalText?: string;
}

// ---------------------------------------------------------------------------
// Chat Messages
// ---------------------------------------------------------------------------

/**
 * Unified chat message type shared across all chat components.
 *
 * The `from` field uses a union of 'user' plus all agent IDs,
 * covering: AvaDeskPanel ('ava'|'user'), FinnDeskPanel ('finn'|'user'),
 * FinnChatModal ('finn'|'user'), EliVoiceChatPanel ('eli'|'user'),
 * ConferenceChatDrawer (senderId-based).
 */
export interface AgentChatMessage {
  /** Unique message ID for React keys. */
  id: string;
  /** Sender: 'user' for the human, or an agent ID. */
  from: 'user' | AgentId;
  /** Message body text. */
  text: string;
  /** Epoch timestamp (ms). Optional for backward compat with existing components that omit it. */
  timestamp?: number;
  /** File attachments on this message. */
  attachments?: FileAttachment[];
  /** Inline rich media on this message (e.g. web images). */
  media?: ChatMediaItem[];
  /** Links this message to an ActiveRun for activity timeline display. */
  runId?: string;
  /** The specific agent that produced this message (useful when `from` is generic). */
  agent?: AgentId;
  /** Whether this message was sent via voice (shows mic indicator). */
  isVoice?: boolean;
  /** Sender display name — used by ConferenceChatDrawer for multi-party rooms. */
  senderName?: string;
  /** Sender user ID — used by ConferenceChatDrawer to distinguish own messages. */
  senderId?: string;
  /** Whether this is a private (Ava-only) message in conference context. */
  isPrivate?: boolean;
}

// ---------------------------------------------------------------------------
// Orchestrator Response Shape
// ---------------------------------------------------------------------------

/**
 * Shape of the /api/orchestrator/intent response body.
 * Used by buildActivityFromResponse and useOrchestratorChat.
 */
export interface OrchestratorResponse {
  response?: string;
  text?: string;
  receipt_id?: string;
  activity?: Array<{
    type: string;
    message: string;
    icon?: string;
  }>;
  route?: {
    skill_pack?: string;
    node?: string;
  };
  risk_tier?: string;
  action?: string;
  governance?: {
    approvals_required?: string[];
    receipt_ids?: string[];
  };
  media?: ChatMediaItem[];
}
