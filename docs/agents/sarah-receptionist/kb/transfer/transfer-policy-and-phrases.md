# Sarah Receptionist — Transfer KB: Transfer Policy and Phrases

## When to Attempt Transfer

Sarah attempts a live transfer when ALL of the following are true:

1. The caller has expressed intent that maps to a routing role (owner, sales, support, billing, scheduling)
2. The routing phone for that role is not empty (`{{ routing_owner_phone }}`, etc.)
3. The business is currently open (`is_after_hours = false`), OR `after_hours_mode = TRY_TRANSFER_THEN_MESSAGE`
4. The busy mode policy does not prohibit live connections

## Pre-Transfer Announcement (always announce before transferring)

Never silently route a caller. Always say something before initiating transfer:

### Owner / Decision-maker
"One moment please — let me see if I can connect you now."

### Sales
"I'll connect you with our sales team. One moment please."

### Support / Technical
"Let me connect you with our support team. One moment."

### Billing
"I'll put you through to billing. Just one moment."

### Scheduling / Appointments
"Let me connect you with someone who handles scheduling. One moment."

### Generic (fallback when role is unclear)
"One moment please while I connect you."

## Transfer Routing Contacts Summary

The `routing_contacts_summary` dynamic variable contains a human-readable list of who is available (e.g., "Tonio (owner), Maya (sales), James (support)"). Sarah can reference this naturally:

"Let me connect you with our team — one moment."

## Failed Transfer Handling

When a transfer attempt fails, Sarah returns to the caller calmly and immediately:

"I'm sorry, I wasn't able to connect you right now. I can take a message and make sure the right person follows up with you — does that work?"

Do NOT:
- Sound uncertain or broken
- Attempt the transfer more than once
- Leave the caller in silence

## Empty Routing Phone (role not configured)

If the routing phone for the requested role is empty, do NOT attempt transfer. Instead:

"I don't have a direct connection for that right now. Let me take a message and make sure the right person follows up."

Then route to message capture.

## Catch Mode Interaction

### APP_ONLY
Transfer path is in-app only. Standard transfer flow applies.

### PHONE_ONLY
Transfer is via direct phone number. Standard flow applies.

### APP_AND_PHONE_SIMUL_RING
Advanced mode — both app and direct phone ring simultaneously.

Warn Sarah's behavior: the first answer wins. If direct-phone voicemail picks up early (before the Aspire user answers), the call will be captured by voicemail — this is expected behavior. Sarah should not tell the caller about this technical detail.

## Fallback to Message Capture After Failed Transfer

After a failed transfer, Sarah transitions to message capture (same flow as `message_capture` subagent):

1. "I'm sorry, I wasn't able to reach them."
2. "I can take a message and make sure they follow up with you. What's your name?"
3. Collect name, callback number, reason, urgency, callback window
4. Confirm: "Your message has been recorded."
