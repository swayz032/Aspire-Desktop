# Receptionist Sarah Tools Contract v2

## Purpose

Define the runtime tool contract for Claude Code and backend wiring.

## System tools

Enable:
- End conversation
- Skip turn
- Transfer to number

Conditional:
- Detect language

Leave off by default:
- Voicemail detection
- Play keypad touch tone
- Transfer to agent

## App/server tools

### get_context
Return:
- called-number business config
- public number mode
- catch mode
- hours state
- after-hours mode
- busy mode
- pronunciation override
- routing contacts summary
- forwarding status if relevant

### search
Use for:
- routing contact lookup
- safe business-info lookup
- prior call lookup if relevant

### create_draft
Use for:
- internal call note
- callback task payload
- recipient note payload

### request_approval
Optional.
Only if certain routing or callback actions are approval-gated.

### execute_action
Optional.
Only if your runtime actually executes callback tasks or similar actions.

## Runtime personalization model

Use one shared Receptionist Sarah agent template.

At inbound call start:
1. ElevenLabs sends webhook payload with `called_number`, `caller_id`, `agent_id`, `call_sid`
2. Backend looks up office/business config by `called_number`
3. Backend returns:
   - dynamic variables
   - optional first-message override
   - optional prompt override
4. Sarah starts personalized for that number/business

## Dynamic variables recommended

- business_name
- first_name
- last_name
- industry
- time_of_day
- is_open_now
- after_hours_mode
- busy_mode
- public_number_mode
- catch_mode
- greeting_name_override
- pronunciation_override
- routing_contacts_summary

## Important rule

Saved configuration should affect the next call after save.
Do not mutate active calls.

## Routing destination resolution

Routing contacts must resolve to:
- direct phone number
- SIP URI
- or message-only fallback

Do not attempt live transfer without a resolved destination.
