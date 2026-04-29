# 03 — Thread Registry and Memory Model

## Objective

Define the shared thread taxonomy, timestamp model, retrieval ranking, and write-back rules.

## 3.1 Canonical thread registry

Every artifact, memory item, and workflow action must attach to one canonical thread.

```ts
export type ThreadType =
  | 'lead_thread'
  | 'customer_thread'
  | 'deal_thread'
  | 'job_thread'
  | 'project_thread'
  | 'estimate_thread'
  | 'quote_thread'
  | 'invoice_thread'
  | 'contract_thread'
  | 'meeting_thread'
  | 'finance_thread'
  | 'task_thread'
  | 'internal_thread';

export interface ThreadRecord {
  thread_id: UUID;
  thread_type: ThreadType;
  scope: ScopedIdentity;
  canonical_entity_type?: EntityType;
  canonical_entity_id?: UUID;
  title: string;
  status: 'open' | 'closed' | 'archived';
  first_event_at: ISODateTime;
  last_activity_at: ISODateTime;
  latest_memory_id?: UUID;
  latest_receipt_id?: UUID;
  latest_approval_id?: UUID;
  participants?: UUID[];
  tags?: string[];
}
```

## 3.2 Thread creation rules

### Lead thread
Create when:
- new inbound call/text/intake
- unknown inbound email becomes a sales/service opportunity
- website/ads lead is captured

### Customer thread
Create when:
- lead is converted to customer
- existing customer is identified as canonical owner of multiple artifacts

### Job / project / estimate / quote / invoice / contract threads
Create when those domain objects become first-class. Do not overload a generic customer thread once a dedicated operational thread exists.

### Finance thread
Create when finance continuity is the primary concern:
- collections case
- provider connection issue
- reconciliation/categorization cluster
- payroll/tax/finance review state

## 3.3 Time model

The time model is mandatory and is shared across memory, receipts, approvals, and workflow references.

### Required timestamps
- `event_at`: when the real-world event happened
- `created_at`: when Aspire persisted the record
- `source_updated_at`: latest update time from source truth
- `promoted_at`: when raw/transient material became durable memory
- `approved_at`: when approval happened
- `executed_at`: when side effect occurred
- `last_activity_at`: current recency/sort key for thread and entity views
- `summary_window_start_at`: start of source material summarized
- `summary_window_end_at`: end of source material summarized
- `fresh_until`: optional freshness horizon

## 3.4 Retrieval ranking

Agent retrieval must use this ordering:

1. exact entity match
2. exact thread match
3. approval/receipt relevance
4. recency by `last_activity_at`
5. freshness by `source_updated_at`
6. confidence score
7. raw transcript fallback only if required

### Do not do this
- sort by `created_at` only
- pull raw transcripts before summaries
- mix finance-only memory into project recommendations without entity/thread match

## 3.5 Latest brief caches

For low-latency agent startup, maintain materialized latest-brief caches.

### Office brief cache
Contains:
- latest office summary
- due-now candidates
- overdue items
- new approvals
- recent receipts
- priority changes in last window

### Finance brief cache
Contains:
- provider freshness/usable status
- unpaid invoices and aging risk
- reconciliation queue state
- cash risk narrative
- finance tasks requiring review

### Thread brief cache
Contains:
- current state summary
- last promise made
- pending blockers
- latest receipt
- next best action

## 3.6 Memory write-back rules

### Write to Office Memory
- Ava session summaries and routing notes
- Sarah intake/missed-call/callback outcomes
- Eli communication outcomes and follow-up summaries
- Nora meeting recaps, decisions, action items
- Tim project/estimate summaries that matter cross-domain
- selected finance summaries that matter cross-domain
- approved document/workflow outcomes

### Write to Finance Memory
- Finn finance briefs and snapshots
- provider connection progress and issue summaries
- collections/reconciliation/categorization outcomes
- invoice/payment/payroll/tax continuity objects
- finance-linked receipts

### Write Canvas references only
Canvas stores references to memory, approvals, and receipts. It should not duplicate long-form memory bodies.

## 3.7 Memory contradiction policy

When source claims conflict:

1. executed receipt beats all
2. approved artifact beats inferred narrative
3. system-of-record truth beats transcript claims
4. latest refined memory beats raw note
5. raw transcript is supporting evidence, not final truth

### Conflict handling output
Write a `decision_fact` or `risk_flag` memory object with:
- conflict description
- conflicting sources
- chosen source ranking
- unresolved/follow-up requirement if no clear winner
