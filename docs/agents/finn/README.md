# Finn Finance Hub ElevenLabs Production Handoff v1

## Objective

Ship Finn as a production-grade **Finance Hub Manager** inside Aspire.

This handoff gives Claude Code everything needed to:
- update the Finn ElevenLabs agent prompt,
- create Finance Hub-specific knowledge-base docs,
- wire Finn to governed Finance Hub tools,
- preserve Aspire approvals, receipts, and tenant isolation,
- keep Finn human, warm, and trusted without turning him into a generic chatbot.

## What this handoff is for

Use this package to implement Finn as:
- a finance specialist voice agent,
- a Finance Hub interpreter,
- a guided bookkeeping workbench manager,
- a governed finance explainer that uses live data first.

Do **not** use this package to make Finn:
- a general business assistant,
- a money-moving agent,
- a direct router to multiple voice agents,
- a silent book mutation layer.

## Verified architecture assumptions

This handoff is aligned to the current Aspire direction validated from the supplied materials:

### Finance Hub v3 posture
- Finance Hub top-level structure:
  - Overview
  - Cash
  - Books
  - Invoices
  - Connections
  - Memory
- Books subpages:
  - Overview
  - Review Queue
  - Reconcile
  - Reports
  - Money Shelves
  - Money Trail
  - Rules
- Page reading model:
  - Status -> Change -> Priority -> Relief -> Proof
- Books mission:
  - Brief
  - Process
  - Govern

### Finance backend posture
- QuickBooks = posting authority
- Plaid = bank truth
- Stripe = invoice/payment truth
- Preview before apply
- Approval required for consequential mutations
- Receipts for state-changing actions
- Idempotency required for mutating routes
- Tenant and office scoping are mandatory
- UI is not trusted to mutate finance state directly

### Office Memory posture
- One office = one memory boundary
- Structured state is truth
- Receipts and ledger are append-only
- RAG is support, not truth
- Memory access is server-governed

### Voice architecture assumptions
- Finn is a **specialist** voice agent
- Finn routes only to **Ava** when the request leaves finance
- Clara remains an internal Aspire capability, not a direct voice handoff target from Finn
- Finn should sound human, close, and trusted: best friend + finance advisor + calm controller

## Package contents

1. `01_FINN_SYSTEM_PROMPT.md`
2. `02_FINN_VOICE_RULES_v1.md`
3. `03_FINN_TASK_WORKFLOWS_v1.md`
4. `04_FINN_STRATEGIC_PLAYBOOK_v1.md`
5. `05_FINANCE_HUB_CANON_v1.md`
6. `06_FINN_TOOLS_CONTRACT_v1.md`
7. `07_ELEVENLABS_AGENT_CONFIG_v1.md`
8. `08_FINN_TEST_MATRIX_AND_SUCCESS_EVAL_v1.md`
9. `09_CLAUDE_CODE_IMPLEMENTATION_PLAN_v1.md`
10. `10_HANDOFF_MANIFEST.json`

## Build order

1. Replace Finn system prompt with `01_FINN_SYSTEM_PROMPT.md`
2. Add the four KB docs:
   - Voice Rules
   - Task Workflows
   - Strategic Playbook
   - Finance Hub Canon
3. Keep KB inline in prompt context while the document set remains small
4. Wire Finn server tools per `06_FINN_TOOLS_CONTRACT_v1.md`
5. Add evaluation criteria and simulation transcripts
6. Enable Focus Guardrail and manipulation/content/custom guardrails where appropriate
7. Run failure-mode tests before production traffic

## Definition of done

Finn is ready when:
- he explains Finance Hub clearly using live data,
- he does not guess on stale or partial data,
- he respects provider truth hierarchy,
- he never mutates books without preview/approval/receipt,
- he routes only to Ava outside finance,
- he sounds human and trusted across normal and stressed conversations.
