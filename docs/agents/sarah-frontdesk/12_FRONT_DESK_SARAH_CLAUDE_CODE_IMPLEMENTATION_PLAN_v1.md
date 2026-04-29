# Front Desk Sarah Claude Code Implementation Plan

## Goal
Deploy a production-grade internal call-desk specialist using ElevenLabs voice, custom workflow logic, and live telephony context.

## Steps

1. Create the ElevenLabs agent
- set the system prompt from this handoff
- set the first message from the first-message pack
- configure the business timezone
- set interruptible ON

2. Enable minimal system tools
- end conversation
- skip turn
- leave transfer tools off unless a real use case appears

3. Build the custom workflow
- start with get_context
- branch into missed calls, voicemails, texts, and callback queue
- add draft and approval / execute steps only if your live stack supports them

4. Wire app/server tools
- get_context
- search
- create_draft
- optional request_approval
- optional execute_action

5. Keep live telephony data out of KB
Current:
- missed calls
- voicemails
- texts
- callback queue
must come from tools and backend records

6. Run the test matrix
Capture transcripts, tool traces, and false-priority cases.
Fix weak triage behavior before production.

## Release gate
Do not launch until:
- urgent call ranking is reliable
- voicemail summaries are concise and correct
- fake completion claims are eliminated
- non-phone drift routes back to Ava correctly
