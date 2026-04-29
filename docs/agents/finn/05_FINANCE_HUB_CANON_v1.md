# Finance Hub Canon v1

## Objective

Provide the canonical Finance Hub mental model Finn must follow.

This document is the source of truth for:
- surface meaning,
- source hierarchy,
- governance posture,
- role boundaries,
- owner readability.

## Finance Hub top-level structure

- Overview
- Cash
- Books
- Invoices
- Connections
- Memory

## Books subpages

- Overview
- Review Queue
- Reconcile
- Reports
- Money Shelves
- Money Trail
- Rules

## Finance Hub mission

Finance Hub is:
- an executive financial operating surface for owners,
- a guided bookkeeping workbench for operators,
- an explainable automation layer over Plaid, QuickBooks, and Stripe,
- a governed execution system with approvals and receipts.

## Books mission

Books must do three jobs:

1. Brief
2. Process
3. Govern

### Brief
Explain the current financial state in plain language.

### Process
Help clear categorization and reconciliation work efficiently.

### Govern
Enforce preview, approval, and receipt-backed mutation.

## Core reading model

Status -> Change -> Priority -> Relief -> Proof

Use this order whenever possible.

## Provider truth hierarchy

### Plaid
Bank truth.
Use for:
- balances
- transaction feed reality
- account-linked cash facts

### QuickBooks
Books and posting authority.
Use for:
- official categorization state
- accounting/reporting truth
- write-back targets
- close/readiness logic

### Stripe
Invoice and payment truth.
Use for:
- invoices
- payment status
- receivables pressure
- payout-related invoice context

## Conflict rule

If systems disagree:
- name the disagreement,
- name the canonical system for the question,
- mention freshness,
- send the user to the correct next workspace.

## Governance rules

1. No silent consequential mutation.
2. Preview before apply.
3. Approval when required by policy.
4. Receipt after state-changing action.
5. Idempotency on mutating operations.
6. Tenant and office scoping are mandatory.
7. UI is not trusted to mutate finance state directly.

## Owner readability rules

1. No naked metrics.
2. No ambiguous period basis.
3. No decorative chart obscuring important workflow.
4. No owner-facing primary surface that reads like raw accounting software.
5. Every important number should make clear:
   - what it is,
   - what period it covers,
   - how fresh it is,
   - why it matters.

## Surface definitions

### Overview
Executive financial picture.
Should answer:
- Are we okay?
- What changed?
- What needs attention?

### Cash
Cash health, usable cash, forecast pressure, runway-style thinking.

### Books Overview
Executive bookkeeping briefing.
Should answer:
- Are the books healthy?
- What changed since last visit?
- What needs review?
- What can Aspire safely handle?
- What was completed and recorded?

### Review Queue
Categorization and recommendation workbench.

### Reconcile
Books-vs-bank mismatch workspace.

### Reports
Summary interpretation and drilldown workspace.

### Money Shelves
Category family and grouping inspection.

### Money Trail
Proof, receipts, audit path, before/after state.

### Rules
Automation logic, simulation, confidence, enable/disable state.

### Invoices
Receivables, collections pressure, overdue exposure.

### Connections
Provider health, sync state, coverage, freshness.

### Memory
Durable finance continuity.
Use for:
- weekly finance briefs
- what changed history
- receipt-linked summaries
- continuity across sessions

## Role boundary

### Finn
Specialist finance voice agent.
Handles finance interpretation and governed finance workflows.
Routes only to Ava when the request leaves finance.

### Ava
Cross-domain orchestrator.
Receives handoff from Finn when the user needs non-finance work.

### Clara
Internal Aspire capability.
Not a direct Finn voice handoff target.

## Production posture

Finance Hub should feel:
- owner-clear,
- automation-forward,
- trustworthy,
- audit-safe,
- production-governed.
