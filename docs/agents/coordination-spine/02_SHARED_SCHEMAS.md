# 02 — Shared Schemas

## Objective

Define the canonical data contracts that all agents and surfaces must share.

## 2.1 Base ID and envelope types

```ts
export type UUID = string;
export type ISODateTime = string;

export interface Provenance {
  source_surface:
    | 'ava_voice'
    | 'sarah_voice'
    | 'eli_inbox'
    | 'nora_meeting'
    | 'finn_finance'
    | 'tim_service_lab'
    | 'estimate_studio'
    | 'canvas_desk'
    | 'receipt_ledger'
    | 'approval_queue'
    | 'system';
  source_agent?: 'ava' | 'sarah' | 'eli' | 'nora' | 'finn' | 'tim' | 'system';
  runtime_family?: 'elevenlabs' | 'anam' | 'internal' | 'ui' | 'provider_webhook';
  channel?: 'voice' | 'video' | 'email' | 'sms' | 'workflow' | 'finance' | 'ui' | 'webhook';
  source_record_id?: string;
  trace_id: string;
  correlation_id: string;
}

export interface ScopedIdentity {
  tenant_id: UUID;
  suite_id: UUID;
  office_id: UUID;
  actor_id?: UUID;
  user_id?: UUID;
}
```

## 2.2 Event envelope

Every source must emit this envelope before any domain-specific payload is processed.

```ts
export interface MemoryEventEnvelope {
  event_id: UUID;
  event_type: string;
  schema_version: 'v1';
  scope: ScopedIdentity;
  provenance: Provenance;
  session_id?: UUID;
  thread_id?: UUID;
  entity_type?: EntityType;
  entity_id?: UUID;
  payload: Record<string, unknown>;
  risk_tier: 'green' | 'yellow' | 'red';
  needs_approval: boolean;
  receipt_required: boolean;
  event_at: ISODateTime;
  created_at: ISODateTime;
  source_updated_at?: ISODateTime;
  idempotency_key: string;
}
```

## 2.3 Entity types

```ts
export type EntityType =
  | 'lead'
  | 'customer'
  | 'deal'
  | 'job'
  | 'project'
  | 'estimate'
  | 'quote'
  | 'invoice'
  | 'contract'
  | 'meeting'
  | 'task'
  | 'provider_connection'
  | 'finance_account'
  | 'payment'
  | 'receipt'
  | 'workflow_run'
  | 'internal_case';
```

## 2.4 Durable memory object

```ts
export interface MemoryObject {
  memory_id: UUID;
  memory_type:
    | 'session_summary'
    | 'handoff_note'
    | 'pending_intent'
    | 'authority_context'
    | 'thread_summary'
    | 'office_brief'
    | 'finance_brief'
    | 'decision_fact'
    | 'risk_flag'
    | 'followup_task'
    | 'timeline_event'
    | 'artifact_reference'
    | 'receipt_reference'
    | 'workflow_reference';
  schema_version: 'v1';
  scope: ScopedIdentity;
  provenance: Provenance;
  entity_type?: EntityType;
  entity_id?: UUID;
  thread_id?: UUID;
  title: string;
  summary: string;
  detail?: Record<string, unknown>;
  confidence: number;
  visibility_scope: 'office' | 'finance' | 'workflow' | 'admin' | 'restricted';
  status?:
    | 'requested'
    | 'drafted'
    | 'pending_approval'
    | 'approved'
    | 'executed'
    | 'rejected'
    | 'superseded'
    | 'failed'
    | 'promoted';
  linked_receipt_ids?: UUID[];
  linked_approval_ids?: UUID[];
  linked_artifact_ids?: UUID[];
  linked_workflow_run_ids?: UUID[];
  event_at: ISODateTime;
  created_at: ISODateTime;
  source_updated_at?: ISODateTime;
  promoted_at?: ISODateTime;
  approved_at?: ISODateTime;
  executed_at?: ISODateTime;
  last_activity_at: ISODateTime;
  summary_window_start_at?: ISODateTime;
  summary_window_end_at?: ISODateTime;
  fresh_until?: ISODateTime;
}
```

## 2.5 Proactive candidate

```ts
export interface ProactiveCandidate {
  candidate_id: UUID;
  schema_version: 'v1';
  scope: ScopedIdentity;
  owner_agent: 'ava' | 'sarah' | 'eli' | 'nora' | 'finn' | 'tim';
  source_event_ids: UUID[];
  source_memory_ids?: UUID[];
  entity_type?: EntityType;
  entity_id?: UUID;
  thread_id?: UUID;
  recommended_action:
    | 'create_draft'
    | 'queue_callback'
    | 'request_approval'
    | 'route_to_agent'
    | 'queue_workflow_trigger'
    | 'surface_warning'
    | 'create_internal_task'
    | 'schedule_outbound_voice'
    | 'none';
  action_class: 'internal_only' | 'draft' | 'approval_request' | 'outbound' | 'workflow';
  why_now: string;
  confidence: number;
  risk_tier: 'green' | 'yellow' | 'red';
  needs_approval: boolean;
  receipt_required: boolean;
  due_at?: ISODateTime;
  cooldown_until?: ISODateTime;
  status: 'open' | 'snoozed' | 'approved' | 'executed' | 'dismissed' | 'expired';
  created_at: ISODateTime;
  last_activity_at: ISODateTime;
}
```

## 2.6 Approval link

```ts
export interface ApprovalLink {
  approval_id: UUID;
  scope: ScopedIdentity;
  approval_type: 'send' | 'call' | 'workflow_execution' | 'finance_action' | 'document_send' | 'other';
  linked_candidate_id?: UUID;
  linked_memory_ids?: UUID[];
  linked_workflow_run_id?: UUID;
  requested_by_agent: 'ava' | 'sarah' | 'eli' | 'nora' | 'finn' | 'tim' | 'system';
  approval_status: 'pending' | 'approved' | 'rejected' | 'expired';
  requested_at: ISODateTime;
  decided_at?: ISODateTime;
  approver_actor_id?: UUID;
  reason?: string;
}
```

## 2.7 Receipt link

```ts
export interface ReceiptLink {
  receipt_id: UUID;
  scope: ScopedIdentity;
  receipt_type:
    | 'email_sent'
    | 'sms_sent'
    | 'call_completed'
    | 'meeting_created'
    | 'workflow_transition'
    | 'finance_state_change'
    | 'document_generated'
    | 'provider_status_change'
    | 'memory_promotion'
    | 'other';
  linked_candidate_id?: UUID;
  linked_approval_id?: UUID;
  linked_memory_ids?: UUID[];
  linked_entity_type?: EntityType;
  linked_entity_id?: UUID;
  event_at: ISODateTime;
  created_at: ISODateTime;
  summary: string;
  proof_payload: Record<string, unknown>;
}
```
