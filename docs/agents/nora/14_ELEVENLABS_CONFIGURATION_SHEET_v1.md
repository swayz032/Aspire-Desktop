# Nora ElevenLabs Configuration Sheet

## Prompt
Use `01_NORA_SYSTEM_PROMPT.md` as the system prompt.

## Dynamic variables required
- business_name
- first_name
- last_name
- salutation
- industry
- meeting_purpose
- recording_mode

## First message
No universal first message is required. Prefer context-sensitive starts.
If needed, use:
- "Nora here. I’m ready when you are."

## Interruptibility
- ON

## Languages
- English by default
- add multilingual support only if required

## Workflow recommendation
Use an ElevenLabs workflow with:
1. start node
2. load session context
3. purpose-aware branch or subagent branch
4. scheduling / briefing / conference / recap flow

## System tools
Enable:
- End conversation
- Skip turn
- Transfer to agent

Optional:
- Detect language
- Transfer to number (usually off)
