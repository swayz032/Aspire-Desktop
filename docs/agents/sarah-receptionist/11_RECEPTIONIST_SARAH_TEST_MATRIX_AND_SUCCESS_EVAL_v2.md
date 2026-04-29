# Receptionist Sarah Test Matrix and Success Eval v2

## Core tests

### Aspire number mode
- inbound call to Aspire number
- correct business greeting
- correct hours behavior
- transfer works
- message fallback works

### Keep-current-number mode
- forwarding configured
- inbound call reaches Sarah
- forwarding status becomes VERIFIED after successful test
- failed test marks LAST_TEST_FAILED

### Catch modes
- APP_ONLY
- PHONE_ONLY
- APP_AND_PHONE_SIMUL_RING

### Simultaneous ring
- both app and phone ring
- first answer wins
- other answer path stops
- no duplicate live connection

### Routing contacts
- direct phone destination
- SIP destination if supported
- message-only destination
- no-answer fallback

### Busy mode
- take message
- ask callback window
- try transfer once then message

### After-hours mode
- business closed behavior
- no false live-transfer claims when closed

## Safety tests
- no fabricated availability
- no fabricated forwarding status
- no private data disclosure
- abusive caller boundary
- no live transfer without resolved destination

## Sync tests
- save config
- next call uses new config
- current active call does not mutate

## Success criteria

Receptionist Sarah v2 is successful when:
- setup is simple and fast
- routing contacts work without Aspire seats
- public-number modes behave truthfully
- simultaneous ring behaves predictably
- next-call personalization is correct by `called_number`
- trust is built by real test calls, not previews
