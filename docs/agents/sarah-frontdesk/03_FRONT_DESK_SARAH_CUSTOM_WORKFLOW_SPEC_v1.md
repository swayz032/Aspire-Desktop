# Front Desk Sarah Custom Workflow Spec

## Workflow type
Build a custom internal workflow. Do not use the external receptionist template.

## Required branches

### 1. Start / get live context
Pull:
- missed calls
- voicemail queue
- text activity
- callback queue
- recent call outcomes
- staleness / confidence

### 2. Urgent summary
Lead with:
- urgent now
- needs callback soon
- waiting on someone else
Do not lead with noise.

### 3. Missed calls branch
For each relevant missed call:
- caller
- timing
- likely importance
- why it matters
- next action

### 4. Voicemail branch
For each relevant voicemail:
- caller
- reason
- timing
- urgency
- callback recommendation

### 5. Text-message branch
For each relevant thread:
- who texted
- what they want
- whether a reply is needed now
- whether text or callback is better

### 6. Callback queue branch
Produce a ranked callback list.
Top signals:
- same-day issue
- active client
- money / estimate / invoice mention
- repeated missed call
- upset tone
- deadline pressure

### 7. Draft next step branch
Support drafting:
- callback note
- follow-up text
- owner-facing summary

### 8. Approval / execute branch
Only for outbound actions that your setup truly supports.
If execution is unavailable, stop at draft or recommendation.

### 9. Wrap-up / end
Close with:
- what matters now
- what is already waiting on others
- what action is recommended next

## Non-negotiable workflow rules
- use live data first
- do not summarize from memory when records exist
- do not fake completion
- do not over-read long transcripts unless asked
- hand non-phone matters back to Ava
