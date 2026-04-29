# Front Desk Sarah Tools Contract

## Purpose
This document tells Claude Code how to wire Front Desk Sarah’s app/server tools to the backend without prompt-tool drift.

## Tool surface for v1

### get_context
Purpose:
- missed-call state
- voicemail queue
- text-thread activity
- callback queue
- recent telephony activity
- staleness / confidence

Suggested backend sources:
- call sessions
- frontdesk voicemails
- frontdesk SMS threads
- frontdesk SMS messages
- callback queue state
- action receipts

Return shape:
- missed_calls_summary
- voicemail_summary
- text_activity_summary
- callback_queue_summary
- recent_activity_summary
- freshness
- confidence

### search
Purpose:
- caller lookup
- voicemail lookup
- text-thread lookup
- prior call record lookup
- callback history

Suggested backend sources:
- call records
- voicemail records
- SMS threads / messages
- action receipts
- provider resources

Return shape:
- matches[]
- record_type
- confidence
- short_summary

### create_draft
Purpose:
- callback note
- follow-up text draft
- owner-facing call summary

Required inputs:
- target_type
- caller_name
- callback_number
- reason
- urgency
- recommended_next_step
- supporting_summary

Suggested backend targets:
- outbox precursor
- internal callback task
- owner-facing summary artifact

### request_approval (optional)
Use only if outbound callback or text requires approval in your live setup.

### execute_action (optional)
Use only if the live stack truly executes:
- SMS send
- callback task
- telephony action
after approval.

## Prompt and tool sync rules
- Sarah must not claim a callback was completed unless execute_action succeeded.
- Sarah must not claim a text was sent unless execute_action succeeded.
- Use get_context first for call-desk summaries.
- Use search before speaking confidently about a specific caller, voicemail, or text thread.
- Keep tenant-specific state in tools, not KB docs.
