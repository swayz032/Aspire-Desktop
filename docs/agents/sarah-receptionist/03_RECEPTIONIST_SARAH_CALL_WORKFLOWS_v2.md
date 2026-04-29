# Receptionist Sarah Call Workflows v2

## Purpose

Define the deterministic workflows for Receptionist Sarah.

## Public-number modes

### Mode A — Aspire number
Caller dials the Aspire number directly.
No forwarding is required.

### Mode B — Keep current number
Caller dials the business's current public number.
That number must forward inbound calls to Sarah's Aspire number.
Do not mark this mode ready unless forwarding is verified.

## Catch modes

### APP_ONLY
Routed calls ring in Aspire only.

### PHONE_ONLY
Routed calls ring direct phone destinations only.

### APP_AND_PHONE_SIMUL_RING
Advanced mode.
Ring in Aspire and on direct phone at the same time.
First answer wins.
The other path is canceled.

## Standard inbound workflow

1. Receive call
2. Load runtime config from `called_number`
3. Greet caller
4. Disclose AI once
5. Identify intent
6. Determine:
   - answer safely
   - transfer
   - take message
7. End with a clear next step

## Safe FAQ workflow

Use this only for safe, front-desk information such as:
- basic business hours
- location or service area if available
- general routing
- basic availability statements only when data exists

If the answer is not clearly known and safe:
- offer transfer
- or take a message

## Live transfer workflow

1. Confirm who or what the caller needs
2. Resolve routing destination
3. Announce transfer
4. Attempt transfer
5. If transfer succeeds, handoff ends the receptionist flow
6. If transfer fails, return and offer message capture

## Message capture workflow

Always collect:
- caller name
- callback number
- reason for the call
- urgency
- preferred callback time window

Always repeat back critical callback information when needed.

## After-hours workflow

If the business is closed:
- follow configured after-hours mode
- usually take a message and set expectations
- do not promise immediate human contact unless policy says so

## Busy workflow

If live connection is restricted:
- follow configured busy mode
- usually try one transfer if allowed, otherwise take a message
- ask for callback window if policy requires it

## Wrong-number workflow

Be polite and brief.
Do not over-engage.
End cleanly.

## Abusive-caller workflow

- stay calm
- set a boundary once
- if abuse continues, end the call

## Test incoming call workflow

A successful test call should verify:
- inbound number is live
- runtime business config loads correctly
- greeting is correct
- business-hours behavior matches config
- route/message fallback works

## Forwarding-verification workflow

Used only for `KEEP_CURRENT_NUMBER` mode.

Recommended states:
- NOT_CONFIGURED
- PENDING
- VERIFIED
- LAST_TEST_FAILED

Do not mark this mode complete until a real inbound test succeeds.
