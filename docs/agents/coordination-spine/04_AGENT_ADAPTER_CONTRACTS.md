# 04 — Agent Adapter Contracts

## Objective

Define how each agent reads from and writes to the shared coordination spine.

## Shared adapter rule

Every agent adapter must implement:

- `build_session_brief()`
- `consume_event()`
- `emit_memory_objects()`
- `emit_proactive_candidates()`
- `request_approval()` when needed
- `emit_receipt_links()` for state changes

## 4.1 Ava adapter

### Role
- chief of staff
- routing/orchestration
- office-wide briefings
- approval visibility
- escalation/rerouting

### Reads
- office brief cache
- thread brief cache
- relevant finance brief when entity-linked
- open approvals
- high-priority candidates

### Writes
- `session_summary`
- `handoff_note`
- `pending_intent`
- `authority_context`
- `timeline_event`

### Ingress contract
```ts
export interface AvaSessionBrief {
  office_brief: string;
  due_now_candidates: ProactiveCandidate[];
  open_approvals: ApprovalLink[];
  recent_receipts: ReceiptLink[];
  routing_hints: Array<{ condition: string; route_to: 'sarah' | 'eli' | 'nora' | 'finn' | 'tim'; }>;
  risk_summary: string;
}
```

### Egress contract
```ts
export interface AvaSessionOutput {
  session_summary: string;
  handoff_notes: MemoryObject[];
  candidate_updates: ProactiveCandidate[];
  requested_approvals?: ApprovalLink[];
}
```

## 4.2 Sarah adapter

### Role
- front desk
- inbound capture
- callback queue
- urgency routing
- evidence-request SMS path when approved

### Reads
- caller/customer thread brief
- missed-call/callback history
- approved callback or evidence-request candidates

### Writes
- intake facts
- missed-call summary
- callback outcome summary
- urgency/routing note
- follow-up task candidates

### Candidate types Sarah may own
- `queue_callback`
- `create_draft` (SMS)
- `route_to_agent`
- `request_approval`

## 4.3 Eli adapter

### Role
- inbox triage
- draft generation
- follow-up rhythm
- reply risk detection

### Reads
- live mailbox thread truth
- Office Memory thread summary
- linked quote/invoice/meeting context
- due candidates for communication

### Writes
- thread summary
- communication outcome summary
- draft artifact references
- follow-up task proposals
- ghosting/reply-risk flags

## 4.4 Nora adapter

### Role
- meetings and conferencing
- prep packets
- transcript bundle handling
- recap and action tracking

### Reads
- participant history
- related thread summary
- prior meeting summary
- due action-item reminders

### Writes
- meeting summary
- decisions
- action items
- unresolved issues
- recap artifact references
- follow-up candidates

## 4.5 Finn adapter

### Role
- finance interpretation
- provider connection guidance
- collections/reconciliation/categorization continuity
- finance brief generation

### Reads
- finance brief cache
- provider truth and freshness
- linked invoice/payment/payroll states
- linked Office Memory when entity-relevant

### Writes
- finance briefs
- provider status summaries
- collections risk flags
- reconciliation/categorization outcome summaries
- finance-linked receipts
- finance follow-up candidates

## 4.6 Tim adapter

### Role
- Service Hub manager
- Estimate Studio operating intelligence
- project planning and estimate continuity
- workflow trigger export packs

### Reads
- project/job/estimate thread brief
- Service Lab truth
- Estimate Studio truth
- prior Office Memory for same project/customer
- relevant finance constraints only when linked

### Writes
- project strategy summary
- estimate assumptions summary
- self-perform/subcontract decisions
- blocker memory objects
- workflow trigger packs
- evidence request candidates

### Hard rule
Tim may create workflow trigger packs, but Canvas Desk remains workflow-only and cannot become the main project-budget or finance analysis surface.

## 4.7 ElevenLabs session adapter rules

All ElevenLabs-backed agents must:

1. receive a thin session brief from Aspire
2. use server tools for live truth lookups/actions
3. emit post-call transcript + metadata to the refinery
4. never treat prompt context as the durable system of record
5. never bypass approval/receipt rails

## 4.8 Shared adapter preflight

Before session start:
- validate tenant/suite/office scope
- validate agent role
- validate allowed tools and capability token scope
- resolve active thread
- fetch latest brief cache(s)
- inject dynamic variables

If any required identity or scope field is missing, fail closed.
