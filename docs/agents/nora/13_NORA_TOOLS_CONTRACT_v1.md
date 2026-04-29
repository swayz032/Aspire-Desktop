# Nora Tools Contract

## ElevenLabs system tools
### Enable
- End conversation
- Skip turn
- Transfer to agent

### Optional
- Detect language
- Transfer to number (usually off for v1)

### Leave off for v1
- Play keypad touch tone
- Voicemail detection

## Voice-facing custom tools
### `get_context`
Returns:
- calendar state
- availability
- meeting purpose
- recording mode
- participant context
- meeting state
- room readiness
- recap context
- Office Inbox context if relevant
- Office Memory context if relevant

### `search`
Returns:
- specific meeting data
- meeting history
- prior notes
- participants
- agenda context
- prior recap packets
- related inbox items
- related memory entries

### `create_draft`
Creates:
- meeting draft
- invite draft
- agenda draft
- recap packet draft
- Office Inbox summary draft
- participant summary draft

### `request_approval`
Used for:
- booking finalization
- invite sending
- recap release
- external summary distribution
- Office Inbox release if gated
- Office Memory promotion if gated

### `execute_action`
Used only after approval and only when the backend action is available.

### `invoke_adam`
Research and briefing support.

### `invoke_quinn`
Invoice and quote follow-up only.

### `invoke_clara`
Contract and signature follow-up.

### `invoke_tec`
Recap PDFs, meeting memos, follow-up documents.

### `post_office_message`
Office Inbox / office message posting.

### `save_office_memory`
Durable meeting memory promotion.

## Voice-transfer destinations
- Eli
- Finn
- Front Desk Sarah
- Ava

## Mapping recommendation
Keep ElevenLabs-facing tool names simple and map them server-side to detailed conference backend actions.
