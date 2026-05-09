# Anam Ava Prompt Contract (LOCKED — 2026-05-07)

This contract defines the mandatory structure, content rules, and invariants for the Anam Ava system prompt at `Aspire-desktop/server/prompts/ava-anam-video-prompt.md`. The validator at `Aspire-desktop/server/routes.ts:243-265` (`validateAnamAvaPromptAndConfig`) enforces every invariant listed here on every session mint — violations HTTP 503 the session when `ANAM_PROMPT_STRICT_VALIDATION=true`.

---

## Why This Contract Exists

Three recurring failures in prior revisions made machine enforcement necessary:

1. **Hardcoded user names polluting multi-tenant prompt.** Names like "Mr. Scott", "Mrs. McCoy", and "Tonio" were embedded as example literals inside rule descriptions. The `.replace()` substitution at `routes.ts:5167-5177` only resolves `{{...}}` placeholders — frozen literals survive rendering and leak into every tenant's session.

2. **Heavy workflow content inlined instead of living in KB.** Quinn's 11-step invoicing workflow, FETCH/PROBLEM/BROWSE/APPROVAL Mode shape definitions, the full banned-phrase list, and card display rules were all embedded in the system prompt. This inflates the prompt past Anam's token ceiling and trains Ava to skip `Knowledge_Ava` because the answer is already in the prompt.

3. **No enforcement — prior agents repeatedly drifted structure between revisions.** Language locks were dropped, length caps moved to the wrong block, banned-phrase blocks vanished from Guardrails, and hardcoded names were re-introduced. Without machine enforcement, every revision risks regression.

---

## How to Modify Invariants

Invariants in this contract are NOT changed unilaterally. Required process:

- Edit this file (`ANAM_AVA_PROMPT_CONTRACT.md`) to describe the new invariant
- Update the matching check in `routes.ts:243-265` to enforce it
- Obtain 2-person review (tonio + one other) before merging
- No agent or subagent may modify invariants without this process — agents may only propose changes via PR

---

## Structural Invariants

- **S-1** — The prompt contains exactly five top-level blocks in this canonical order: `# Personality` → `# Environment` → `# Tone` → `# Goal` → `# Guardrails`. No extra top-level sections before, between, or after these five.
- **S-2** — Each of the five block names is a Markdown H1 heading using a single `# ` prefix (one hash, one space, then the exact block name). No `##`, `###`, or bracket variants for these headings.
- **S-3** — Token budget: `prompt.length / 4 < 4000`. Warn when `prompt.length / 4 > 3500`. Hard error when `prompt.length / 4 > 4500`. Target: approximately 3,500 tokens (~14,000 characters). Validator enforces the hard error at 4,500 tokens.
- **S-4** — Prompt body is Markdown only. No fenced code blocks (` ``` `), no JSON objects, no XML tags in the prompt body. Reference data belongs in KB docs, not inline.
- **S-5** — No duplicate section headers. Each of the five block names appears exactly once as a top-level heading.

---

## Forbidden Anywhere

- **F-1** — Zero hardcoded user names anywhere in the prompt body. Banned literal strings (case-sensitive): `Mr. Scott`, `Mrs. McCoy`, `Mr. Cory`, `Tony`, `Tonio`, `McCoy`. Also banned: any first name or last name that is not enclosed in `{{...}}` double-brace placeholders. User identity flows only through template substitution.
- **F-2** — No unresolved injection placeholders. Banned: `{{voiceHandoffBrief}}` (must be removed, not left as placeholder), literal `[VOICE HANDOFF CONTEXT]` blocks, any `[ASPIRE_CTX:...]` markers (those are V2 LangGraph markers — V1 Ava uses direct webhook injection).
- **F-3** — No validator-banned strings. Banned phrases that break prior validators: `"transfer to specialist agents immediately"`, `"switch to voice mode"`. These trigger routing logic that does not exist in V1 Ava.
- **F-4** — No inline workflow definitions that belong in KB. The following content types must NOT appear in the prompt body — they must reference the KB doc by name instead:
  - Full FETCH / PROBLEM / BROWSE / APPROVAL Mode shape definitions (multi-paragraph)
  - Quinn 11-step invoicing workflow steps (full numbered list)
  - Full banned-phrase list (more than 5 examples inline)
  - Full card display rules per entity type (PROPERTY / PRODUCT / STORE / HOTEL / VENDOR multi-paragraph specs)

---

## Per-Block Invariants

### Personality Block (P-1 through P-5)

- **P-1** — The first non-empty content line after `# Personality` matches the language lock regex: `/American English only|Always respond in English/i`. This rule must come before any identity or trait description.
- **P-2** — The block contains exactly one substantive user-identity line using the `{{salutation}} {{last_name}}` pattern (the line that establishes who Ava is talking to). The `{{...}}` placeholder syntax is required — no literal name substituted in the prompt body.
- **P-3** — The block identifies Ava as chief of staff at `{{business_name}}`. The `{{business_name}}` placeholder must appear in the Personality block.
- **P-4** — The block names the ICP: SMB owner-operators in trades or contractor industries. This framing must be explicit (not implied).
- **P-5** — The salutation rule is described abstractly without hardcoded example names. Correct pattern: "Address user as `{{salutation}} {{last_name}}`; fall back to `{{first_name}}` when salutation or last_name is missing; omit greeting label when both are absent." Incorrect: any sentence containing "Mr. Scott", "Mrs. McCoy", or similar literals as examples.

### Environment Block (E-1 through E-4)

- **E-1** — States the medium explicitly: live video call on the user's device or website widget.
- **E-2** — References `{{has_camera}}` to describe Ava's visual awareness state. The placeholder must appear in this block.
- **E-3** — Delegates date and time awareness to the `ava_get_context` tool. Must include a statement that Ava never guesses the current date or time.
- **E-4** — Contains NO length-cap rule. The sentence/word limit belongs in Tone. Validator checks that `/Under \d+ words/i` does NOT appear in the Environment block.

### Tone Block (T-1 through T-5)

- **T-1** — The first substantive rule in this block is the length cap. Required text: `"Under 40 words. One topic per turn. Maximum 2 sentences."` (or equivalent phrasing with the 40-word limit explicit). Validator: `/Under 40 words/i` must appear in the first 500 characters of the Tone block.
- **T-2** — A TTS-safety paragraph is present. Required content: instruction to spell out all symbols and abbreviations, ban on markdown formatting in output, and at least one example of written-out form (e.g., "one hundred million dollars" not "$100M", "ten percent" not "10%", "and" not "&").
- **T-3** — Pacing and cadence rules are present: period-ended sentences, em-dash for pauses, 18-word maximum per sentence guideline.
- **T-4** — Three to four natural acknowledgment examples are present (e.g., "Got it.", "On it.", "Makes sense.", "Understood.").
- **T-5** — A user check-in pattern is present. Required phrasing anchors: `"Make sense?"` or `"Does that work?"` or equivalent one-to-two word turn signals.

### Goal Block (G-1 through G-6)

- **G-1** — The first sub-block in Goal is the WORKFLOW TRIGGER RULE. Text must include the instruction to call `Knowledge_Ava` FIRST for "how do I..." or operational questions, before invoking `invoke_adam`. Validator: `/WORKFLOW TRIGGER RULE/i` must appear in the first 1,500 characters of the Goal block.
- **G-2** — The `show_cards` mandate appears within the first 1,500 characters of the Goal block. Required marker: `## CRITICAL — show_cards is required after invoke_adam`. Validator checks for this exact string.
- **G-3** — A five-step session workflow is present as a numbered list: (1) greet → (2) gather context → (3) understand need → (4) execute → (5) confirm completion.
- **G-4** — A greeting hierarchy section is present with PRIMARY / FALLBACK / LAST RESORT labels. All name references in this section use ONLY `{{salutation}}`, `{{last_name}}`, `{{first_name}}`, `{{time_of_day}}` placeholders. No literal example names.
- **G-5** — Heavy workflows are delegated to KB by name. The Goal block contains only ONE-LINE pointers per response shape (FETCH / PROBLEM / BROWSE / APPROVAL / CONFIRMATION / SILENCE) — not full definitions. The block must reference at least three of the four KB doc names: `Ava_Voice_Rules_v6`, `Strategic_Playbook_v6`, `Tools_and_Cards_v6`, `Invoicing_and_Quotes_v6`.
- **G-6** — The block contains `## ava_search` OR `## search` (legacy validator compatibility).

### Guardrails Block (GD-1 through GD-7)

- **GD-1** — The first sub-block is `## NEVER SAY`. This section contains a subset of banned phrases critical to session behavior, with at least one positive counter-example per banned phrase. Full banned-phrase list lives in `Ava_Voice_Rules_v6.txt` KB doc — the prompt contains only the critical subset (five or fewer phrases).
- **GD-2** — The AI self-reference rule appears in the first five lines of the Guardrails block body. Required phrasing anchor: `"Never discuss being an AI"` or equivalent. Validator: `/Never discuss being an AI/i` within first 1,000 characters of Guardrails block.
- **GD-3** — The P0 Voice Rule is present: Ava must speak within 5 seconds of any tool result. Text anchor: `"speak within 5 seconds"` or `"P0 Voice Rule"`.
- **GD-4** — The approval-queue rule is present: all state changes (invoices, quotes, approvals) go through Quinn and then the authority queue. Ava never calls `execute_action` directly.
- **GD-5** — The `tax_market_value` property rule is present: property value references use county market value, not AVM (automated valuation model). Text anchor: `"county market value"` or `"tax_market_value"`.
- **GD-6** — The apt/unit pass-verbatim rule is present: apartment and unit numbers are passed to Adam exactly as spoken by the user; Adam normalizes server-side. Text anchor: `"pass verbatim"` or `"Adam normalizes"`.
- **GD-7** — Browse Mode silence protocol is referenced by pointer only. Full text lives in `Ava_Voice_Rules_v6` KB doc. The prompt contains a one-line pointer: "Full Browse Mode silence protocol: see `Ava_Voice_Rules_v6` in Anam KB."

---

## KB Delegation Rules

Heavy content lives in four Anam KB docs organized across three folders. The prompt references these by name — it does NOT inline their content.

**Folder structure:**

| Folder Name (LOCKED) | Local source path | KB doc(s) |
|---|---|---|
| `Ava Voice Rules` | `Aspire-desktop/server/kb/ava/v6/ava-voice-rules/` | `Ava_Voice_Rules_v6.txt` |
| `Ava Tools and Cards` | `Aspire-desktop/server/kb/ava/v6/ava-tools-and-cards/` | `Tools_and_Cards_v6.txt`, `Strategic_Playbook_v6.txt` |
| `Ava Invoicing and Quotes` | `Aspire-desktop/server/kb/ava/v6/ava-invoicing-and-quotes/` | `Invoicing_and_Quotes_v6.txt` |

**Canonical IDs:**
- Folder IDs: see `Aspire-desktop/server/kb/ava/v6/folder-ids.json` (canonical source)
- `Knowledge_Ava` tool ID: `af247cb8-d1ce-4721-9ebe-d0ec397ba9eb`
- Anam Ava persona ID: `58f82b89-8ae7-43cc-930d-be8def14dff3`

**Content ownership (what lives where):**
- `Ava_Voice_Rules_v6.txt` — Tone, banned phrases, vocabulary substitution list, pacing, browse mode full protocol, response shapes (FETCH/PROBLEM/BROWSE/CONFIRMATION/SILENCE mode definitions), How to Sound examples
- `Tools_and_Cards_v6.txt` — Adam tool protocols, card display rules (property/product/store/hotel/vendor), browse mode after show_cards, re-display pattern, tool re-fire ban, card error handling
- `Strategic_Playbook_v6.txt` — Research-first protocol, recommendation structure, multi-turn strategic conversations, industry-specific vocabulary, budget and time-pressed handling
- `Invoicing_and_Quotes_v6.txt` — Quinn 11-step invoicing workflow, quote variant, customer onboarding mid-workflow, approval queue rule, common mistakes

---

## Folder Naming Convention (LOCKED)

Any new KB folder added to the Anam Ava knowledge base must satisfy all four rules:

- **Rule 1 — Title Case with spaces.** No slashes, underscores, or hyphens in folder names.
- **Rule 2 — Lead with persona or owner.** Folder name begins with: `Ava`, `Clara`, `Adam`, `Aspire`, or the name of the owning persona.
- **Rule 3 — Action or content suffix.** Folder name ends with: `Rules`, `Workflows`, `Protocols`, or `Knowledge`.
- **Rule 4 — No version numbers in folder names.** Version numbers belong on documents (e.g., `v6`), not on folders. Folders are permanent homes; docs inside them are replaceable.

Correct: `Ava Voice Rules`, `Clara Workflows`, `Adam Research Protocols`, `Aspire Platform Knowledge`
Incorrect: `ava-voice-rules`, `Ava_Tools/Cards`, `General instructions v6`, `Invoice/Quotes`

---

## Tool Wiring Strategy

**Current (ship now):** One fan-in `Knowledge_Ava` tool (`af247cb8-d1ce-4721-9ebe-d0ec397ba9eb`) covers all Ava-prefixed folders. Its `documentFolderIds` array points to all three folders. Its description covers all three content domains so the LLM routes correctly.

**Future split threshold:** When either condition is true, split into four thematic tools:
- `documentFolderIds` count exceeds 5, OR
- Retrieval accuracy drops below 80% in spot-checks (verified via Anam Lab debug modal)

**Thematic tool names when splitting:** `search_voice_rules`, `search_workflows`, `search_research_protocols`, `search_aspire_platform`.

---

## User Identity Injection (LOCKED)

User identity flows through exactly two code sites. No other mechanism is permitted.

- `lib/anam-iframe.ts:378-380` — `addContext()` call that seeds the session with user data from the iframe token
- `routes.ts:5167-5177` — `.replace()` substitution that resolves `{{...}}` placeholders before the prompt reaches Anam

**Permitted template variables** (all must use `{{double-brace}}` syntax):
`{{salutation}}`, `{{last_name}}`, `{{first_name}}`, `{{business_name}}`, `{{has_camera}}`, `{{date}}`, `{{time_of_day}}`, `{{industry}}`

**Prohibited:** Any hardcoded fallback name value. If `salutation` or `last_name` is missing, the greeting is omitted — not replaced with a literal like "Mr. Scott" or "Tonio". The prompt must describe this omission behavior abstractly.

---

## Enforcement

**Runtime:** Validator at `Aspire-desktop/server/routes.ts:243-265` (`validateAnamAvaPromptAndConfig`) checks all invariants on every session mint. Errors are pushed onto the existing `errors[]` array. With `ANAM_PROMPT_STRICT_VALIDATION=true` (production Railway env), any non-empty `errors[]` causes an HTTP 503 response before the Anam session is created.

**CI (recommended):** `.github/workflows/anam-prompt-contract.yml` runs the validator on every PR that touches `ava-anam-video-prompt.md` or `ANAM_AVA_PROMPT_CONTRACT.md`. Merge is blocked on validator failure. This is duplicative defense — the runtime validator already enforces in strict mode.

**Invariant count:** 5 Structural + 4 Forbidden + 5 Personality + 4 Environment + 5 Tone + 6 Goal + 7 Guardrails = **36 invariants total**.

---

## Change Log

| Date | Author | Change | Approved By |
|---|---|---|---|
| 2026-05-07 | tonio + Claude | Initial contract locked | tonio |
