---
name: Round 7 patterns
description: Anti-patterns, gaps, and verified findings from the Round 7 Anam Ava adversarial review
type: project
---

# Round 7 Patterns (2026-04-30)

## Confirmed Working
- `_emit_playbook_receipt` coverage: TOOL_MATERIAL_PRICE_CHECK has 3 call sites (store_disambiguation, FAILED, SUCCEEDED). Other playbooks covered by server.py `_adam_receipt` wrapper.
- Receipt status casing: Python path uses `outcome_lower` via status_map -> uppercase SUCCEEDED/FAILED/DENIED. TypeScript path uses uppercase directly. Both correct.
- Policy-1 gate: `isinstance(val, bool)` on server.py correctly drops null, strings like "true".
- `include_other_stores=null` (JSON null): Python `isinstance(None, bool)=False` -> ignored -> False default applies.
- All 10 D.4 snapshot assertions present and verified in both prompt files.
- `emitEarlyExitReceipt` fail-path: catches Supabase errors, logs warning, response still sent.
- `store_receipts` is non-blocking (enqueues to async writer). Safe to call from async context.

## Issues Found

### P0
1. Prompt contradiction — hardcoded "Mr. Scott" at THREE locations overrides Greeting State precision:
   - Line 23 Environment section: "If name variables are unavailable, default to saying: Mr. Scott."
   - Line 130 Guardrails section: "If name variables are unavailable, say Mr. Scott."
   - Line 374 Closing section: "On goodbye, always say: Goodbye, Mr. Scott."
   These three rules mean Ava WILL say "Mr. Scott" in non-greeting contexts even when first_name is known. The Greeting State subsection (lines 37-43) says omit — but the global rules override.

### P1
2. `emitEarlyExitReceipt` uses `office_id: safeOfficeId` where `safeOfficeId = safeSuiteId`. The receipts table has `office_id uuid`. If safeSuiteId is not a valid UUID (e.g. empty string or env slug), the INSERT silently fails (caught at line 1116), violating Law #2. Same class of failure as Round 5 CHECK constraint issue.
3. `services_needed` and `current_tools` in plan spec but NOT in actual SELECT at agentToolRoutes.ts:462-469. Minor spec drift.
4. TTS noise root cause unverified — plan acknowledges Plan B (Anam support ticket) but actual greeting in transcript 3ca28bc6 was "Good evening, Mr. Scott." (no trailing em-dash, valid period ending). The fix addresses the THEORY but may not address the actual cause.
5. D.6 verification script uses `"Yes, I'm here. What can I do?"` — this exact string is not in the prompt (prompt has `"I'm here. What can I do for you?"`). Would fail as an exact-match assertion.

### P2
6. No test for: include_other_stores=True + both HD AND shopping empty -> correct error + hd_has_stock=False.
7. No test for: user_address provided but malformed JSON-encoded string (e.g. contains unescaped quotes).
8. No test for: RLS blocking the briefing query (Supabase returns error, not null). The catch at line 571 returns status:'error' gracefully — but no test verifies this.
9. All 74 Round 7 tests are mock-based. Zero real-network tests for SerpApi 429 behavior at scale.
10. `owner_name: profile?.owner_name || 'Unknown'` at line 530 — Ava receives string "Unknown" in context and must suppress it via prompt rule alone (no server-side guard).

## Recurring Anti-Patterns
- Team consistently does not test RLS blocking / Supabase unavailability at the briefing handler layer.
- team consistently uses `office_id = suite_id` as a shortcut in TypeScript receipt writes, without UUID validation — causes silent receipt failures.
