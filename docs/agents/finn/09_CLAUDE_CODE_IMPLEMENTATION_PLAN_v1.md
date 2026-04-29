# Claude Code Implementation Plan v1

## Objective

Give Claude Code a deterministic implementation sequence for Finn.

## Phase 1 — Agent configuration

1. Update Finn system prompt using `01_FINN_SYSTEM_PROMPT.md`
2. Set Finn first message to:
   - `Hey {{salutation}} {{last_name}}, Finn here.`
3. Add these KB docs:
   - `02_FINN_VOICE_RULES_v1.md`
   - `03_FINN_TASK_WORKFLOWS_v1.md`
   - `04_FINN_STRATEGIC_PLAYBOOK_v1.md`
   - `05_FINANCE_HUB_CANON_v1.md`
4. Keep KB inline and do not enable RAG yet
5. Enable Focus Guardrail and base safety guardrails

## Phase 2 — Server tool layer

Build Finn wrappers over Finance Hub APIs.

### Minimum wrappers
- `finn_get_context`
- `finn_get_overview`
- `finn_get_cash_truth`
- `finn_get_review_queue`
- `finn_get_reconciliation_queue`
- `finn_get_reports_summary`
- `finn_get_ar_aging`
- `finn_get_rules`
- `finn_simulate_rule`
- `finn_preview_writeback`
- `finn_apply_writeback`
- `finn_get_money_trail`
- `finn_save_finance_memory`

### Mapping guidance
Where possible, wrap the existing finance backend pack endpoints rather than inventing parallel route families.

## Phase 3 — Office Memory wiring

1. Route Finn memory writes through the server-governed Memory Service only
2. Support these artifact types first:
   - weekly_finance_brief
   - what_changed_summary
   - cleanup_snapshot
   - collections_pressure_summary
   - tax_readiness_summary
   - receipt_explanation
3. Ensure office boundary and capability scope are always enforced

## Phase 4 — Evaluation and hardening

1. Add ElevenLabs evaluation criteria from `08_FINN_TEST_MATRIX_AND_SUCCESS_EVAL_v1.md`
2. Run simulation transcripts for core flows
3. Run adversarial prompt-injection and stale-data tests
4. Confirm routing-only-to-Ava behavior
5. Confirm mutating operations cannot bypass preview/approval/receipt

## Phase 5 — Production readiness gates

### Required before exposure to real users
- structured logs with correlation IDs
- explicit stale-data states
- tenant/office scoping verified
- idempotency on all mutating paths
- receipt generation verified
- safe retry behavior verified
- prompt and tone consistency reviewed on real transcripts

## File integration suggestions

### Prompt and KB source control
Store these in a dedicated handoff folder in the repo, for example:
- `docs/agents/finn/01_FINN_SYSTEM_PROMPT.md`
- `docs/agents/finn/02_FINN_VOICE_RULES_v1.md`
- `docs/agents/finn/03_FINN_TASK_WORKFLOWS_v1.md`
- `docs/agents/finn/04_FINN_STRATEGIC_PLAYBOOK_v1.md`
- `docs/agents/finn/05_FINANCE_HUB_CANON_v1.md`

### Server tools
Suggested area:
- `backend/src/agents/finn/`
- `backend/src/finance/`
- `backend/src/memory/`

## Non-negotiables

- fail closed
- no money movement
- no silent mutation
- preview before apply
- approval where required
- receipt after apply
- QuickBooks / Plaid / Stripe hierarchy preserved
- Finn routes only to Ava

## Final instruction to Claude Code

Implement Finn as a production-grade Finance Hub specialist, not a general assistant.
Keep him warm and human.
Keep him data-first.
Keep him governed.
