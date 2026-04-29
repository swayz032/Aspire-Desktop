# 06 — Implementation Plan and Acceptance

## Objective

Define the deterministic rollout sequence, risks, test plan, and acceptance gates.

## 6.1 Build order

### P0 — spine foundations
1. shared ID package
2. thread registry
3. time model and recency policy
4. event envelope
5. durable memory object schema
6. approval/receipt link schemas
7. memory search + brief caches

### P1 — sync services
8. Session Broker
9. Entity/Thread Resolver
10. Transcript/Event Refinery
11. Business Reasoning -> Proactive Candidate service
12. Workflow/Approval Bus
13. Receipt Ledger integration

### P2 — agent adapters
14. Ava adapter
15. Sarah adapter
16. Eli adapter
17. Nora adapter
18. Finn adapter
19. Tim adapter

### P3 — product surface integration
20. Office Memory UI reads
21. Finance Memory UI reads
22. Canvas Desk workflow candidate consumption
23. Service Lab / Estimate Studio write-backs
24. latest office brief / weekly brief views

### P4 — pattern intelligence hooks
25. tenant-safe normalized export objects
26. cohort-safe learning pipeline
27. evaluation loops only after sync is stable

## 6.2 Definition of done

The coordination spine is complete when:

1. every agent session starts via Session Broker
2. every source emits the same base event envelope
3. every event resolves to a canonical thread/entity
4. every durable memory object carries the full time model
5. recent retrieval uses entity/thread/receipt/recency/confidence ranking
6. Canvas Desk consumes only workflow triggers, blockers, reminders, approvals, and execution state
7. project/job budget truth remains in Service Lab
8. company finance truth remains in Finance Hub
9. every state-changing action emits a receipt
10. latest brief caches update deterministically after writes
11. no agent owns a separate memory system
12. raw transcripts are not the default reasoning surface

## 6.3 Test plan

### Unit tests
- schema validation for all contracts
- ranking tests for recency retrieval
- conflict-resolution tests
- candidate dedupe/cooldown tests
- idempotent ingestion tests

### Integration tests
- Sarah missed-call -> callback candidate -> approval -> receipt -> memory write
- Eli draft follow-up -> approval -> send -> receipt -> thread summary update
- Nora meeting recap -> action-item candidates -> Canvas routine -> receipt
- Finn invoice-aging risk -> finance brief update -> collections draft candidate
- Tim evidence gap -> Sarah SMS evidence request draft -> approval -> send
- Ava briefing reads latest office state across memory + approvals + receipts

### Negative tests
- cross-tenant access denied
- Canvas tries to read unauthorized finance truth
- Service Lab tries to overwrite Finance Hub truth
- duplicate event ingestion does not duplicate receipts or candidates
- missing identity/scope fields fail closed
- raw transcript only, no refinement -> no direct candidate creation without policy pass

### Observability tests
- end-to-end trace propagation
- dead-letter replay works
- consumed-but-missing-receipt monitor
- materializer lag alerting

## 6.4 Major risks

### Risk 1: duplicate truth stores
Mitigation:
- strict ownership matrix
- reference links instead of duplicated truth

### Risk 2: wrong latest-memory behavior
Mitigation:
- full time model
- explicit retrieval ranking
- brief caches

### Risk 3: Ava becomes a second system
Mitigation:
- Ava required to use the same broker and memory service as all other agents

### Risk 4: transcript sprawl
Mitigation:
- transcript/event refinery required before durable reasoning

### Risk 5: over-eager proactivity
Mitigation:
- candidate cooldowns
- approval gates
- office quiet hours
- one-owner rule per candidate

## 6.5 Claude implementation instructions

### Engineering posture
- production first
- deterministic contracts over ad hoc adapters
- server-governed execution only
- receipt linkage everywhere
- append-only event history where feasible
- materialized read models for low latency

### File/folder suggestion
```text
/contracts
  /schemas
  /examples
/services
  /session-broker
  /memory-service
  /refinery
  /reasoning
  /workflow-bus
  /receipt-ledger
/adapters
  /ava
  /sarah
  /eli
  /nora
  /finn
  /tim
/materializers
  /office-brief
  /finance-brief
  /thread-brief
/tests
```

## 6.6 Final recommendation

Do not start by building shared-learning or pattern-intelligence exports.  
Start by making the coordination spine and time-aware memory model correct.  
Once sync is reliable, then export normalized learning artifacts.
