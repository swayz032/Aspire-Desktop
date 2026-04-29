# Ava KB — Handoff Protocol v1

## The three-object pattern

Every Ava handoff writes exactly three coordinated memory objects. All three share one `correlation_id`. This is the atomic handoff primitive — they live or die together (transactional write).

| Object type | memory_type | Contents | Who reads it |
|---|---|---|---|
| `pending_intent` | `pending_intent` | What the owner wants to accomplish | Receiving agent + session broker |
| `authority_context` | `authority_context` | Risk tier, escalation reason, any approval requirements already established | Receiving agent for governance decisions |
| `handoff_note` | `handoff_note` | One-paragraph normalized prose summary — the full picture in 100 words or less | Receiving agent reads this FIRST, before any other action |

The `create_handoff_note` tool writes all three in a single transactional call. It returns `handoff_id` = `correlation_id`.

## What goes in each object

### pending_intent
Plain statement of what the owner wants. Written in present tense. No jargon.

Good examples:
- "Owner wants to review cash position and understand why invoice backlog grew last week."
- "Owner wants to schedule a follow-up with Marcus after the estimate was approved."
- "Owner wants to understand what emails are outstanding before the Friday deadline."

Bad examples:
- "User query related to financial matters" (too vague)
- "The user has expressed interest in..." (bureaucratic — write it as a statement)

### authority_context
Governance context the receiving agent needs before taking action. Includes:
- `risk_tier` (GREEN / YELLOW / RED)
- Any approvals already given in this session
- Any escalation trigger ("owner flagged this as urgent")
- Relevant capability token scope hints

If no special authority applies, write: `"Standard session. risk_tier=GREEN. No prior approvals in this session."`

### handoff_note
One paragraph. Written so a receiving agent can orient instantly, without asking the owner to repeat themselves.

Structure: Who → What they need → Relevant context → What Ava did or decided → What comes next.

Example:
```
Tonio Scott ({{business_name}}, painting industry) is asking about cash position and recent invoice backlog growth. He mentioned a specific concern about the last two weeks. Ava surfaced the office brief, confirmed open approvals, and routed to Finn for deeper analysis. No approvals were given this session. Risk tier is GREEN. Finn should lead with the cash overview and then cover the invoice aging detail.
```

## How correlation_id ties the three objects

All three objects share the same `correlation_id` field in `memory_objects`. This means:

- `GET /v1/memory/search?correlation_id={handoff_id}` returns all three in one query
- `POST /v1/session-broker/start` with `{handoff_id}` in dynamic variables resolves all three and injects `handoff_note` as the first item in the session brief
- The Anam video session bootstrap uses this same pattern: `runtime_family='anam_video'` + `handoff_id`

## Voice → video handoff flow

When the owner's request requires a video session (contract review, authority-level approval, complex strategy):

1. Ava writes the three-object handoff note via `create_handoff_note` with `receiving_agent='anam_video'`
2. `create_handoff_note` returns `handoff_id`
3. Ava tells the owner: "I have saved everything for your video session. Ava video will have the full context."
4. The desktop client receives `handoff_id` from the tool response and shows a "Continue in video" button that opens Anam with `?handoff_id={handoff_id}`
5. Anam session broker reads all three objects by `correlation_id` and builds the session brief with `handoff_note` first
6. Anam Ava reads `handoff_note` on first turn — owner does not repeat themselves

## Receiving agent protocol

The receiving agent (Finn, Eli, Nora, Sarah) reads the `handoff_note` FIRST, before looking up any other memory or asking the owner any questions.

The receiving agent should:
1. Acknowledge in one sentence (without reading the note aloud): "Got it, Tonio. Let me pull up the cash picture."
2. Act on the context in `pending_intent`
3. Respect any `authority_context` governance signals

The receiving agent should NOT:
- Ask the owner to repeat what they told Ava
- Ignore the `authority_context` risk tier
- Write its own `pending_intent` — Ava already wrote it

## Governing rules

- Ava MUST write a handoff note before every `route_to_*` call. No exceptions.
- `create_handoff_note` failure = do not route. Surface the error, ask owner if they want to retry.
- handoff_note is immutable after write. Corrections are new notes with new `correlation_id`.
- All three objects are scoped to `tenant_id + suite_id + office_id`. Cross-tenant reads are blocked at the DB layer by RLS.
- PII in `pending_intent` and `handoff_note` is redacted by Presidio DLP before persistence. Ava writes plain business context — never SSNs, payment credentials, or raw contract values.
