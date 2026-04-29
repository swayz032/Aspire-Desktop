# Eli Tools Contract v1

## Purpose

This file tells Claude Code how Eli's prompt and KB docs expect the tool layer to behave.

## Required public Eli tool names

Eli prompt and KB are aligned to these names:

- `get_context`
- `search_emails`
- `draft_email`
- `request_approval`
- `execute_action` (optional at runtime, but must be accounted for)

## Required semantic behavior

### 1. `get_context`
Returns live inbox state.

Minimum fields:
- mailbox_connected: boolean
- provider_hint: enum or string
- unread_count: number
- urgent_count: number or nullable
- recent_activity_summary: string or structured items
- connection_health / sync_freshness if available

Used for:
- inbox status
- urgency picture
- basic mailbox connectivity truth

### 2. `search_emails`
Returns searchable mailbox context.

Must support:
- sender lookup
- subject lookup
- keyword/topic lookup
- thread lookup

Ideal return fields:
- thread_id
- message_id
- subject
- from
- to / cc summary
- snippet
- received_at
- thread_state summary
- enough context for a safe spoken summary

Important:
- if `search_emails` returns only snippets, Claude Code should add a deeper read path internally or extend the endpoint so Eli can safely summarize important threads

### 3. `draft_email`
Creates a draft for:
- reply
- new outbound

Minimum input expectations:
- recipient list
- subject
- body or intent details
- thread linkage if replying

Minimum return fields:
- draft_id
- recipient summary
- subject
- body preview or concise summary
- thread_id if applicable

### 4. `request_approval`
Submits the draft into the approval path.

Minimum return fields:
- approval_id
- status
- draft_id
- next_step

### 5. `execute_action`
Executes send only after approval.

Minimum input:
- approval_id

Minimum return:
- outcome status
- sent_message_id or provider result if successful
- failure reason if unsuccessful

## Mapping guidance for current backend reality

Current backend evidence suggests:
- public ElevenLabs tool names are generic gateway tools
- backend pack actions map into Polaris / internal rails
- mailbox provider can be Polaris, Gmail, Outlook, or IMAP

Claude Code should keep user-facing semantics stable even if provider routing changes behind the scenes.

## Input normalization rules

When converting voice input:
- "at" -> @
- "dot" -> .
- remove spaces in email addresses
- confirm unusual spellings when low confidence exists

## Fail-closed behavior

If the send step is not attached or not available:
- Eli may still draft
- Eli may still request approval
- Eli must not claim the email went out

## Recommended implementation note

Keep Eli mailbox-agnostic at the prompt layer and provider-specific at the adapter layer.
