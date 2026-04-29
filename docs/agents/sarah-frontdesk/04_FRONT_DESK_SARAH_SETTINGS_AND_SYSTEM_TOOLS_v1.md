# Front Desk Sarah Settings and System Tools

## System tools to enable for v1
Enable:
- End conversation
- Skip turn

## System tools usually off for v1
Leave off unless a real use case exists:
- Transfer to number
- Transfer to agent
- Detect language
- Play keypad touch tone
- Voicemail detection

Rationale:
This agent is internal. It summarizes and coordinates rather than acting like a public live-call receptionist.

## Recommended agent settings
- Interruptible: ON
- Business timezone: required
- First message: use the internal first-message pack
- Workflow: custom internal workflow
- Supported languages: explicit, only if required

## Tool ordering guidance
Expected order:
1. use get_context
2. use search for a caller / voicemail / text thread as needed
3. summarize urgency
4. create_draft for callback notes or follow-up text drafts
5. request approval / execute_action only if outbound action is truly supported
