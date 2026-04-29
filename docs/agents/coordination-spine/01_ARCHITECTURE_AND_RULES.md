# 01 — Architecture and Rules

## Objective

Establish the system topology, ownership boundaries, and hard rules for syncing Aspire agents and product surfaces.

## Architecture summary

```mermaid
flowchart LR
  subgraph Sources[Source Surfaces]
    S1[ElevenLabs Voice Sessions]
    S2[Inbox / Email Threads]
    S3[Meetings / Conference Events]
    S4[Service Lab / Estimate Studio]
    S5[Finance Hub / Providers]
    S6[Canvas Desk Workflow Events]
  end

  subgraph Spine[Aspire Coordination Spine]
    B1[Session Broker]
    B2[Transcript / Event Refinery]
    B3[Entity + Thread Resolver]
    B4[Memory Service]
    B5[Business Reasoning Engine]
    B6[Proactive Candidate Queue]
    B7[Workflow / Approval Bus]
    B8[Receipt Ledger]
  end

  subgraph Agents[Cowork Space / AI Team Members]
    A1[Ava]
    A2[Sarah]
    A3[Eli]
    A4[Nora]
    A5[Finn]
    A6[Tim]
  end

  subgraph Surfaces[Execution Surfaces]
    X1[Drafts]
    X2[Approvals]
    X3[Canvas Desk Routines]
    X4[Receipts]
  end

  S1 --> B1
  S2 --> B1
  S3 --> B1
  S4 --> B1
  S5 --> B1
  S6 --> B1

  B1 --> B2 --> B3 --> B4
  B4 --> B5 --> B6
  B6 --> Agents
  B4 --> Agents

  A1 --> X1
  A2 --> X1
  A3 --> X1
  A4 --> X1
  A5 --> X1
  A6 --> X1

  X1 --> B7 --> X2
  B6 --> X3
  X2 --> B8
  X3 --> B8
  B8 --> B4
```

## Domain truth ownership

### Company-finance truth
Owner: Finance Hub  
Includes:
- bank/balance/transaction/provider state
- accounting truth rails
- invoice/payment/payroll/tax continuity where finance-owned
- finance provider freshness and queue state

### Project/job planning truth
Owner: Service Lab  
Includes:
- project budgets
- package budgets
- staffing strategy
- subcontract strategy
- equipment/rental strategy
- project margin floor / safer-path / best-path / bigger-bet

### Technical estimate truth
Owner: Estimate Studio  
Includes:
- visual/evidence intake
- plans/photos/specs
- takeoff assumptions
- package pricing assumptions
- estimate options
- RFI/submittal drafting and status when estimate-owned

### Workflow execution truth
Owner: Canvas Desk  
Includes:
- approvals
- blockers
- reminders
- follow-ups
- routines
- execution transitions

### Continuity/context truth
Owner: Office Memory + Finance Memory  
Includes:
- thread summaries
- handoff notes
- pending intents
- authority context
- brief summaries
- memory-linked receipts
- cross-domain context references

## Hard rules

1. No surface may silently claim another surface's truth.
2. No agent may own a separate memory architecture.
3. Every consequential action must be approval-gated or explicitly risk-tiered green.
4. Every state-changing action must emit a receipt.
5. Canvas Desk receives workflow triggers only.
6. Pattern intelligence is an export/output layer, not a primary write target.
7. Raw transcripts are secondary evidence, not the default reasoning surface.
8. All write operations are server-governed. No client-side tool execution.
9. Tenant isolation and deny-by-default access are mandatory.
10. All contracts are append-only friendly and replayable.

## Execution states

Every action-like object in Aspire must map to one of these states:

- `requested`
- `drafted`
- `pending_approval`
- `approved`
- `executed`
- `rejected`
- `superseded`
- `failed`
- `promoted` (for durable memory promotion)

## Cross-cutting controls

### Identity controls
- tenant-scoped IDs
- suite and office scoping
- actor and agent provenance
- capability-token checks for tools

### Safety controls
- deny by default
- correlation IDs
- idempotency keys
- retries with backoff for safe operations
- dead-letter strategy for failed webhook/event processing
- structured errors
- PII redaction at refinery boundaries where appropriate

### Observability controls
- event trace IDs
- workflow trace IDs
- session IDs
- memory write metrics
- approval latency metrics
- receipt integrity checks
