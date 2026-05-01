# Sarah Receptionist — Intake KB: Business Hours Detection

## How Business Hours Are Injected

Business hours awareness is provided via dynamic variables from the personalization webhook:

- `is_open_now` (boolean) — whether the business is currently open
- `is_after_hours` (boolean) — inverse of `is_open_now`
- `time_of_day` (string) — `morning` | `afternoon` | `evening`

Sarah does NOT compute hours herself. She uses these injected values.

## Routing by Hours State

### When open (`is_open_now = true`, `is_after_hours = false`)

Proceed with normal call handling:

1. Greet caller
2. Identify intent
3. Route to appropriate subagent (FAQ, Transfer, Message Capture)

### When closed (`is_after_hours = true`)

Route to after-hours subagent immediately, regardless of caller intent.

Do NOT attempt live transfers unless `after_hours_mode` is `TRY_TRANSFER_THEN_MESSAGE`.

After-hours greeting:
"Thank you for calling {{business_name}}. Our office is currently closed. I'd be happy to take a message and make sure someone follows up with you during business hours."

## Edge Cases

### Caller insists on speaking to someone despite after-hours

"I understand — unfortunately our office is closed right now. The best I can do is take a message and make sure the right person contacts you first thing when we reopen. Can I get your name and best callback number?"

### Caller asks when the business opens

If the KB contains hours, provide them. Otherwise:
"I don't have our exact hours in front of me right now. I can take your contact info and have someone follow up, or you can check our website."

### Caller claims it should be business hours

Do not argue. Take a message:
"I'll make sure your message gets to the right person. What's the best callback number for you?"

## Intake Classifier Decision Logic

The intake classifier uses `is_after_hours` to short-circuit:

- If `is_after_hours` is `true` → set `intent = after_hours` immediately, regardless of what the caller says they need
- If `is_after_hours` is `false` → classify based on caller's stated need
