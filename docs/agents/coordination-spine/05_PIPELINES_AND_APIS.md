# 05 — Pipelines and APIs

## Objective

Define the event flow and minimal API surfaces required for sync.

## 5.1 End-to-end sync pipeline

```text
source event
-> event envelope
-> entity/thread resolution
-> transcript/event refinery
-> durable memory write
-> proactive candidate creation
-> approval / workflow routing
-> execution
-> receipt emission
-> memory + latest-brief cache update
```

## 5.2 Pipeline steps

### Step 1: source event emission
Any source emits `MemoryEventEnvelope`.

### Step 2: entity/thread resolution
Map to canonical entity + canonical thread.

### Step 3: refinement
Convert raw event/transcript/provider state change into one or more `MemoryObject` records.

### Step 4: memory/index update
Write durable memory and update brief caches.

### Step 5: reasoning
Determine whether a `ProactiveCandidate` should be emitted.

### Step 6: action path
Candidate goes to one of:
- internal suggestion only
- draft
- approval request
- Canvas workflow trigger
- scheduled outbound path

### Step 7: receipt
If state changed, emit a `ReceiptLink`.

## 5.3 Service contracts

### POST /v1/session-broker/start
Request:
```json
{
  "agent": "eli",
  "tenant_id": "tenant_123",
  "suite_id": "suite_123",
  "office_id": "office_123",
  "actor_id": "user_123",
  "session_channel": "voice",
  "entity_type": "quote",
  "entity_id": "quote_456",
  "thread_id": "thread_789"
}
```

Response:
```json
{
  "session_id": "sess_123",
  "thread_id": "thread_789",
  "dynamic_variables": {
    "office_brief": "Two approvals pending. Quote follow-up overdue. Invoice aging risk on ACME project.",
    "thread_summary": "Customer requested revision on Monday; no reply since Tuesday.",
    "risk_tier": "yellow"
  },
  "allowed_tools": ["get_recent_memory", "create_draft", "request_approval"],
  "trace_id": "trace_123"
}
```

### POST /v1/memory-events
Accepts `MemoryEventEnvelope`.

### POST /v1/refinery/run
Input:
```json
{
  "event_id": "evt_123"
}
```

Output:
```json
{
  "memory_ids": ["mem_1", "mem_2"],
  "candidate_ids": ["cand_1"]
}
```

### POST /v1/memory/search
Request:
```json
{
  "tenant_id": "tenant_123",
  "office_id": "office_123",
  "thread_id": "thread_789",
  "entity_type": "quote",
  "entity_id": "quote_456",
  "memory_types": ["thread_summary", "handoff_note", "receipt_reference"],
  "limit": 10
}
```

### POST /v1/proactive-candidates/query
Request:
```json
{
  "tenant_id": "tenant_123",
  "office_id": "office_123",
  "owner_agent": "eli",
  "status": ["open", "snoozed"],
  "due_before": "2026-04-29T09:00:00Z"
}
```

### POST /v1/approvals/request
Accepts `ApprovalLink` creation payload.

### POST /v1/receipts/write
Accepts `ReceiptLink` creation payload.

## 5.4 Idempotency and retries

### Required behavior
- event ingestion: idempotent by `idempotency_key`
- receipt writes: idempotent by external action reference or correlation ID
- approval requests: dedupe by candidate + action + thread/entity scope
- candidate creation: dedupe within active cooldown window

### Retry policy
- safe event processing: exponential backoff with jitter
- dead-letter after max retries
- manual replay support for dead-letter queues

## 5.5 Latest-brief materializers

Materializers should update on:
- memory write
- approval change
- receipt write
- candidate state change
- thread last-activity change

### Materializers
- `/v1/briefs/office/{office_id}`
- `/v1/briefs/finance/{office_id}`
- `/v1/briefs/thread/{thread_id}`

## 5.6 Security contract

Every API call must include:
- tenant/suite/office scope
- actor or service principal identity
- capability token where relevant
- trace/correlation ID

All server tools exposed to ElevenLabs must terminate in Aspire-controlled endpoints and may not expose direct provider credentials to the client.
