# Backend Alignment Notes v2

## Required backend truths

1. Use `called_number` as the primary inbound office/business lookup key.
2. Keep one shared Sarah agent template.
3. Return dynamic variables at call start from personalization webhook.
4. Saved changes apply to new calls only.
5. Do not mutate active calls.

## Product truth updates

### Business name
Do not ask again in Front Desk Setup.
Use onboarding business name as source of truth.

### Routing Contacts
Support non-seat routing contacts as first-class entities.

### Aspire Team Seats
Future concept.
Do not require seats for routing.

### Public-number modes
- ASPIRE_NUMBER
- KEEP_CURRENT_NUMBER

### Catch modes
- APP_ONLY
- PHONE_ONLY
- APP_AND_PHONE_SIMUL_RING

### Forwarding status
Implement:
- NOT_CONFIGURED
- PENDING
- VERIFIED
- LAST_TEST_FAILED

## Important honesty rule

Do not imply that typing in an existing business number automatically makes it Sarah's inbound number.

That is only true if:
- the number forwards to Sarah
- or is imported as an inbound-capable number
- or is connected through SIP/PBX

## Transfer mapping

Map routing contacts to:
- external phone numbers
- SIP URIs
- or message-only fallback

## Simultaneous ring note

Support for simultaneous ring should be treated as advanced.
Document and test first-answer-wins behavior.
