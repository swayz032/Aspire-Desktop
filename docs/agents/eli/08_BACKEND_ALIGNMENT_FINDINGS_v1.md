# Backend Alignment Findings v1

## Scan summary

Backend scan shows Eli is already modeled as a real inbox specialist, but the current persona scaffolding is stale compared with the desired production behavior.

## Verified findings

### Eli pack manifest
Observed:
- `can_read_email`
- `can_triage_email`
- `can_draft_email`
- `can_send_email`

Tools listed:
- `polaris.email.read`
- `polaris.email.draft`
- `polaris.email.send`
- `internal.email.triage`

Interpretation:
- Eli is meant to be a real mailbox operator, not just a summarizer

### Tool policy
Observed action mapping:
- `email.read` -> `polaris.email.read`
- `email.triage` -> `internal.email.triage`
- `email.draft` -> `polaris.email.draft`
- `email.send` -> `polaris.email.send`

Interpretation:
- send exists in backend policy
- draft and send are governed actions

### Gateway tool pattern
Observed gateway endpoints:
- `/v1/tools/context`
- `/v1/tools/search`
- `/v1/tools/draft`
- `/v1/tools/approve`
- `/v1/tools/execute`

Interpretation:
- public ElevenLabs tool names may still be generic, even if backend provider rails are specialized

### Setup script
Observed legacy public tool naming:
- `get_context`
- `search`
- `create_draft`
- `request_approval`
- `execute_action`

Interpretation:
- production Eli prompt needs tighter naming if the actual live agent uses `search_emails` and `draft_email`
- Claude Code should normalize public tool names and keep docs synchronized

### Mail provider model
Observed provider support includes:
- Polaris
- Gmail
- Outlook
- IMAP

Interpretation:
- prompt should describe an Aspire connected inbox, not hardcode Gmail-only behavior
- Gmail-connected behavior is clearly part of the architecture

## Implementation recommendation

Canonical user-facing model:
- "Aspire connected inbox"

Canonical specialist truth:
- live mailbox data first
- provider adapter hidden from end-user
- prompt and KB docs stay stable even if provider routing changes
