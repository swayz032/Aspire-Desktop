# Claude Code Implementation Plan v2

## Phase 1 — Simplify the setup UI

Implement Front Desk Setup v2:
- Public Number
- Catch Mode
- Business Hours
- Routing Contacts
- When We’re Busy
- Save changes
- Test incoming call

Remove:
- business name field
- audio preview
- common reasons customers call
- Aspire team seats from this flow

## Phase 2 — Config model

Implement canonical config shape:
- public_number_mode
- catch_mode
- routing_contacts
- business_hours
- after_hours_mode
- busy_mode
- forwarding_status
- called_number
- office_id
- owner_user_id
- pronunciation_override

## Phase 3 — Runtime personalization

Implement number-keyed lookup:
- personalization webhook receives `called_number`
- load office/business config
- return dynamic variables and overrides

## Phase 4 — Routing

Implement routing contacts as real destinations:
- phone number
- SIP URI
- message-only fallback

Map transfer actions to `transfer_to_number`.

## Phase 5 — Catch mode

Implement:
- APP_ONLY
- PHONE_ONLY
- APP_AND_PHONE_SIMUL_RING

Treat simultaneous ring as advanced.
Document:
- first answer wins
- other path is canceled
- direct-phone voicemail risk

## Phase 6 — Forwarding verification

Implement verification state for `KEEP_CURRENT_NUMBER` mode:
- NOT_CONFIGURED
- PENDING
- VERIFIED
- LAST_TEST_FAILED

Do not mark setup complete until a real inbound test succeeds.

## Phase 7 — QA

Run the v2 test matrix before release.
