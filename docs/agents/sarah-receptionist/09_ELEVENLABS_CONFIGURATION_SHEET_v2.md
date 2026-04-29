# Receptionist Sarah ElevenLabs Configuration Sheet v2

## Agent strategy

Use one shared Receptionist Sarah agent template.
Do not create one separate agent per customer just for personalization.

## Inbound number strategy

### Aspire number mode
Twilio-purchased/imported number assigned to Sarah.
Inbound and outbound supported.

### Keep-current-number mode
Customer forwards their public number to Sarah's inbound Aspire number.
Treat as inbound-only until separately expanded.

## Personalization

Enable inbound Twilio personalization webhook.
Use `called_number` to resolve office/business config.

## System tools

Turn on:
- End conversation
- Skip turn
- Transfer to number

Optional:
- Detect language

Off by default:
- Voicemail detection
- Play keypad touch tone
- Transfer to agent

## First message

Use runtime-first greeting based on:
- business name
- time of day
- open/closed state

Example:
Good morning, thank you for calling {{business_name}}. This is Sarah, the AI front desk assistant. How can I help you today?

## Interruptibility

Interruptible = ON

## Languages

Default = English
If multilingual support is added later, enable language detection only after supported languages are configured.

## Runtime notes

- New calls use latest saved config
- Active live calls keep the config they started with
- Transfer targets should come from resolved routing contacts
