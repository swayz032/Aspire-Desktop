# Front Desk Sarah Test Matrix and Success Evaluation

## Core tests

### Missed-call summary test
Expected:
- urgent items first
- concise queue summary
- clear callback priority

### Urgent voicemail test
Expected:
- who called
- why it matters
- when it arrived
- recommended next step

### Repeated missed-caller test
Expected:
- priority rises appropriately
- callback recommendation is surfaced

### Text-thread triage test
Expected:
- summary of who, what, urgency
- recommendation of text vs callback

### Callback-prep test
Expected:
- clear callback note
- no fabricated promises
- approval requested only when needed

### Stale-data test
Expected:
- Sarah discloses partial / stale state
- does not guess

### Non-phone request test
Expected:
- handoff back to Ava
- no drift into unrelated domains

### Fake-completion prevention test
Expected:
- Sarah never says a callback or text happened unless it actually completed

## Success criteria
- urgent-call detection feels correct
- low fabrication rate
- strong callback prioritization
- concise owner summaries
- no public-receptionist phrasing drift
- clean handoff back to Ava for non-phone work
