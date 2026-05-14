/**
 * Calls & Messages — types matching migration 114 schema (Wave 7).
 *
 * Distinct from `types/frontdesk.ts` (which mirrors migration 052 — the older
 * `Voicemail`, `CallSession`, `BusinessLine` shapes). Migration 114 introduces
 * the receptionist-driven `frontdesk_contacts`, `frontdesk_voicemails`, and
 * extends `call_sessions` with `contact_id` + `transcript_summary`.
 *
 * This file is the source of truth for the Calls & Messages tab UI.
 */

export type ContactStatus = 'unconfirmed' | 'active' | 'blocked';
export type VoicemailUrgency = 'low' | 'medium' | 'high';
export type CallDirection = 'inbound' | 'outbound';

export interface FrontdeskContact {
  contact_id: string;
  suite_id: string;
  phone_e164: string;
  display_name: string;
  company: string | null;
  email: string | null;
  status: ContactStatus;
  total_calls: number;
  last_call_summary: string | null;
  last_seen_at: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface FrontdeskVoicemail {
  voicemail_id: string;
  suite_id: string;
  contact_id: string | null;
  caller_name: string | null;
  callback_number: string | null;
  call_reason: string | null;
  call_summary: string | null;
  urgency: VoicemailUrgency;
  wants_callback: boolean;
  audio_uri: string | null;
  duration_seconds: number | null;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface FrontdeskCallSession {
  call_session_id: string;
  suite_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  from_number: string | null;
  to_number: string | null;
  duration_seconds: number | null;
  transcript_summary: string | null;
  started_at: string;
  ended_at: string | null;
  direction: CallDirection;
}

export interface ContactPatch {
  display_name?: string;
  company?: string | null;
  email?: string | null;
  notes?: string | null;
  tags?: string[];
  status?: ContactStatus;
}
