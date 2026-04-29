# Front Desk Sarah Production Handoff

## Purpose
This handoff is for Claude Code to configure **Front Desk Sarah** as the internal owner-facing call-desk specialist for many businesses.

## Scope
This package includes:
- production system prompt
- first-message pack
- custom internal workflow spec
- settings and system-tool guidance
- general-purpose KB docs
- app/server tools contract
- test matrix
- implementation plan

## Core design rules
- This agent is internal and owner-facing.
- Do not use the external receptionist workflow template here.
- Keep tenant-specific data out of KB docs.
- Fetch live missed calls, voicemails, texts, callback status, and line state from tools.
- Lead with urgency and next action.
- Never claim outbound action happened unless it actually completed.
- Hand non-phone work back to Ava.

## Multi-tenant rule
These KB docs are reusable across many businesses. They contain general doctrine only.
Tenant-specific facts must come from:
- dynamic variables
- get_context
- search
- telephony records
- callback queues
- live message state

## Recommended implementation order
1. Configure system tools and settings
2. Attach the system prompt
3. Build the custom internal workflow
4. Connect app/server tools
5. Attach the KB docs
6. Run the test matrix
7. Review transcripts and refine weak triage behavior
