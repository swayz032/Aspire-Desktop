/**
 * Front Desk Enterprise Types
 * Matches DB schema from migration 052_frontdesk_enterprise.sql
 */

export type LineMode = 'ASPIRE_FULL_DUPLEX' | 'EXISTING_INBOUND_ONLY';
export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'ringing' | 'in_progress' | 'completed' | 'failed' | 'voicemail' | 'blocked';
export type MessageDirection = 'inbound' | 'outbound';
export type TranscriptStatus = 'pending' | 'complete' | 'failed';
export type ResourceStatus = 'provisioning' | 'active' | 'releasing' | 'released' | 'failed';

export interface BusinessLine {
  businessLineId: string;
  suiteId: string;
  ownerOfficeId: string;
  lineMode: LineMode;
  businessNumber: string | null;
  existingNumber: string | null;
  country: string;
  businessName: string | null;
  businessHours: Record<string, { enabled: boolean; start: string; end: string }>;
  afterHoursMode: string;
  pronunciation: string | null;
  enabledReasons: string[];
  questionsByReason: Record<string, string[]>;
  targetByReason: Record<string, string>;
  busyMode: string;
  teamMembers: TeamMember[];
  setupComplete: boolean;
  greetingVoiceId: string;
  provisionedStatus?: ResourceStatus;
}

export interface TeamMember {
  name: string;
  role: 'Sales' | 'Support' | 'Scheduling';
  extension: string;
}

export interface FrontDeskSetup extends BusinessLine {
  // Extended from BusinessLine — represents the GET /api/frontdesk/setup response
}

export interface CallSession {
  call_session_id: string;
  suite_id: string;
  business_line_id: string;
  owner_office_id: string;
  direction: CallDirection;
  status: CallStatus;
  from_number: string | null;
  to_number: string | null;
  caller_name: string | null;
  duration_seconds: number | null;
  provider: string;
  provider_call_id: string;
  started_at: string;
  ended_at: string | null;
  recording_url: string | null;
  voicemail_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SmsThread {
  thread_id: string;
  suite_id: string;
  owner_office_id: string;
  business_line_id: string;
  business_number_e164: string;
  counterparty_e164: string;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  created_at: string;
}

export interface SmsMessage {
  sms_message_id: string;
  suite_id: string;
  thread_id: string;
  direction: MessageDirection;
  body: string;
  num_segments: number | null;
  media_count: number;
  media_urls: string[];
  delivery_status: string | null;
  provider: string;
  provider_message_sid: string | null;
  received_at: string | null;
  created_at: string;
}

export interface Voicemail {
  voicemail_id: string;
  suite_id: string;
  business_line_id: string;
  owner_office_id: string;
  call_session_id: string | null;
  from_e164: string | null;
  to_e164: string | null;
  duration_seconds: number | null;
  transcript_status: TranscriptStatus;
  transcript_preview?: string;
  transcript_text?: string;
  has_recording: boolean;
  recording_uri?: string;
  created_at: string;
}

export interface AvailableNumber {
  e164: string;
  locality: string;
  region: string;
  capabilities?: Record<string, boolean>;
}
