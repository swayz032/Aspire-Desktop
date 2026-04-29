# Aspire Coordination Spine — Contract Pack Handoff for Claude

Status: Production-grade handoff v1  
Prepared for: Claude Code / implementation  
Date: 2026-04-28

## Objective

Define the shared contracts, schemas, APIs, adapter boundaries, and implementation sequence required to sync:

- Ava (orchestrator; adapter defined here because Ava ZIP was not attached)
- Sarah / Receptionist / Front Desk
- Eli
- Nora
- Finn
- Tim / Service Lab / Estimate Studio
- Office Memory
- Finance Memory
- Canvas Desk
- receipts / approvals / workflows

into one governed Aspire runtime.

## Source basis

This contract pack is grounded in the uploaded Aspire artifacts and session decisions, especially the following file families:

- Office Memory / Finance Memory V1
- Canvas Desk production handoff
- Estimate Studio V5.1 / V6
- Service Lab production handoff
- finance/backend execution packs and roadmap artifacts
- Sarah / Eli / Finn / Nora handoffs

## Locked product rules carried into this pack

1. Canvas Desk is workflow execution only. It owns approvals, blockers, follow-ups, reminders, and execution routines. It does not own dense finance dashboards or project-budget truth.
2. Service Lab owns project/job planning truth.
3. Estimate Studio owns technical estimate and procurement truth.
4. Finance Hub owns company finance truth.
5. Memory is continuity/context truth, not a replacement for domain truth.
6. Consequential actions require approval and receipts.
7. Tenant isolation is non-negotiable.
8. All contracts in this pack are time-aware; recent memory retrieval must not rely on `created_at` alone.

## Deliverables in this pack

- `01_ARCHITECTURE_AND_RULES.md`
- `02_SHARED_SCHEMAS.md`
- `03_THREAD_REGISTRY_AND_MEMORY_MODEL.md`
- `04_AGENT_ADAPTER_CONTRACTS.md`
- `05_PIPELINES_AND_APIS.md`
- `06_IMPLEMENTATION_PLAN_AND_ACCEPTANCE.md`
- `examples/` JSON payload examples

## Assumptions

- Ava ZIP was not attached. This pack defines an Ava adapter contract based on the current Aspire operating model rather than an Ava file diff.
- ElevenLabs remains the low-latency voice runtime. Aspire remains the memory, policy, approval, receipt, and business-reasoning system.
- Existing repos may contain partial generic memory infrastructure; this pack should be treated as the authoritative sync contract for the newer unified model.

## Primary implementation principle

Do **not** merge all product handoffs into one giant spec.  
Keep each handoff owning its domain and add one shared coordination spine underneath them.

## Contract pack map

```text
Aspire Coordination Spine
├── Session Broker
├── Memory Service
├── Transcript/Event Refinery
├── Business Reasoning Engine
├── Workflow/Approval Bus
└── Receipt Ledger
```

## Hand-off instruction to Claude

Implement this pack in the following order:

1. shared IDs and thread registry
2. timestamp + recency model
3. event envelope + memory object contracts
4. session broker
5. transcript/event refinery
6. agent adapters
7. workflow/approval/receipt linking
8. UI read models and latest-brief caches
9. pattern-intelligence export hooks only after tenant-safe sync is stable
