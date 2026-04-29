# Claude Code Implementation Plan v1

## Objective

Wire Eli so prompt, KB, tools, and backend behavior agree.

## Phase 1 — Normalize the public Eli tool surface

Target names:
- `get_context`
- `search_emails`
- `draft_email`
- `request_approval`
- `execute_action`

Do not leave mixed public naming like:
- `search`
- `create_draft`

If older gateway names remain for compatibility, create a thin alias layer and keep Eli docs aligned to one canonical public contract.

## Phase 2 — Bind Eli to live mailbox truth

Required behavior:
- inbox summaries must come from live context
- specific email/thread summaries must come from live search/read behavior
- do not let Eli summarize important threads from subject line alone when deeper context exists

## Phase 3 — Implement the triage engine

Implement the five-bucket model:
- Urgent now
- Needs reply soon
- Waiting on someone else
- Reference only
- Noise

Use weighted ranking from the triage KB:
- sender importance
- subject signals
- body keywords
- deadline phrases
- money / approval / signature phrases
- thread state
- response ownership
- bulk/promo clues

## Phase 4 — Draft flow

For replies:
1. identify thread
2. pull live context
3. generate draft
4. generate spoken summary

For new outbound:
1. confirm recipient
2. confirm purpose
3. confirm CTA / deadline
4. generate draft
5. generate spoken summary

## Phase 5 — Approval flow

1. user confirms spoken draft summary
2. `request_approval`
3. surface approval status cleanly
4. only call `execute_action` if:
   - approval granted
   - execute tool available

## Phase 6 — Failure handling

If any step fails:
- Eli acknowledges the limitation
- Eli does not guess
- Eli does not fake send completion
- Eli hands back to Ava if the task cannot proceed

## Phase 7 — Observability

Track:
- tool call success rate
- search hit quality
- draft success rate
- approval request success rate
- send success rate
- false "important" triage rate
- false "noise" triage rate
- user correction rate on thread summaries

## Phase 8 — Regression testing

Run the full matrix in `10_ELI_TEST_MATRIX_AND_SUCCESS_EVAL_v1.md` before production rollout.
