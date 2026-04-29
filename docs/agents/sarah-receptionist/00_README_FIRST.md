# Receptionist Sarah Production Handoff v2

This package updates Receptionist Sarah to match the current Aspire product model.

## What changed from v1

- Simplified **Front Desk Setup**
- Removed redundant setup concepts:
  - business name field
  - audio preview section
  - common reasons customers call
  - Aspire team seats from this setup flow
- Added **Routing Contacts** as first-class non-seat destinations
- Added **Catch Mode** as a first-class runtime setting
- Clarified the two public-number modes:
  - `ASPIRE_NUMBER`
  - `KEEP_CURRENT_NUMBER`
- Standardized runtime sync:
  - saved changes apply to **new calls**
  - active calls do not mutate mid-call
- Standardized personalization:
  - one shared Receptionist Sarah agent template
  - per-call personalization loaded from `called_number`
- Added simultaneous ring as an **advanced first-answer-wins test mode**

## Product truth

Receptionist Sarah should already know how to handle normal receptionist call types from:

- system prompt
- KB docs
- workflow
- routing policy

Front Desk Setup should only control:

- what number customers dial
- how humans catch routed calls
- business hours
- after-hours handling
- busy handling
- routing contacts
- transfer and fallback behavior

## Front Desk Setup v2

### Section 1 — Public Number
- Get an Aspire business number
- Keep my current number and forward it to Sarah

### Section 2 — How you catch calls
- Ring in Aspire
- Ring my phone
- Ring both (advanced)

### Section 3 — Business Hours
- weekly hours
- after-hours handling

### Section 4 — Routing Contacts
- non-Aspire people who can receive transferred calls or call notes

### Section 5 — When We’re Busy
- take message
- ask for callback window
- try live transfer once, then message

### Section 6 — Actions
- Save changes
- Test incoming call

## Runtime model

1. Inbound call arrives to an Aspire-assigned inbound number.
2. ElevenLabs calls the personalization webhook at call start.
3. Backend looks up config by `called_number`.
4. Backend returns dynamic variables and optional overrides.
5. Sarah starts with the right office/business policy for that number.
6. If Sarah needs to route to a human, she uses:
   - app ring
   - direct phone ring
   - simultaneous ring (advanced)
   - or later SIP/PBX

## Key business distinction

### Routing Contacts
Routing Contacts do not require Aspire paid seats.

### Aspire Team Seats
Aspire Team Seats are future richer in-app users and are out of scope for Front Desk Setup v2.

## Most important implementation rule

Saved changes apply to **the next call after save**.

Do not mutate active live calls.
