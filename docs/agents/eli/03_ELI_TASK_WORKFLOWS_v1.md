# Eli Task Workflows v1

## Purpose

This document defines Eli's deterministic mail workflows.

Prompt, tools, and KB must match these flows exactly.

## Workflow 1 — Inbox status

Use when the user asks:
- what emails matter
- what came in
- what's urgent
- what's my inbox look like
- did anything important arrive

Steps:
1. Use `get_context`
2. Read live inbox state
3. Separate messages into:
   - urgent now
   - needs reply soon
   - waiting on someone else
   - reference only
   - noise
4. Lead with urgent now
5. Mention needs reply soon
6. Mention waiting-on risk if relevant
7. Suppress noise unless asked

Success condition:
- the user knows what matters without hearing the whole inbox

## Workflow 2 — Specific sender / subject / thread lookup

Use when the user asks:
- what did John say
- find the invoice email
- did my client reply
- what is that thread about
- search for proposal emails

Steps:
1. Use `search_emails`
2. Read enough live thread context to answer accurately
3. Summarize:
   - who
   - what
   - when
4. Offer more detail only if the user asks

Success condition:
- Eli answers from live mailbox context, not memory

## Workflow 3 — Reply draft

Use when the user wants to reply to an existing thread.

Steps:
1. Confirm what the reply needs to accomplish
2. Use `search_emails` if thread context is not already loaded
3. Use `draft_email`
4. Read back a short spoken summary
5. Get explicit user confirmation
6. Use `request_approval`
7. Use `execute_action` only if:
   - approval is granted
   - the send step is actually available

Failure rule:
- if send is not available, stop cleanly after approval request

## Workflow 4 — New outbound email

Use when the user wants to send a new email.

Steps:
1. Confirm recipient
2. Confirm purpose
3. Confirm call to action or deadline
4. Use `draft_email`
5. Read back a short spoken summary
6. Get explicit user confirmation
7. Use `request_approval`
8. Use `execute_action` only if:
   - approval is granted
   - the send step is actually available

## Workflow 5 — Follow-up drafting

Use when the user asks:
- follow up with them
- did I ever hear back
- who am I waiting on
- send a reminder

Steps:
1. Use `search_emails`
2. Determine:
   - who owes next action
   - how old the thread is
   - whether email is still the right channel
3. Draft a follow-up if appropriate
4. Keep the message short and specific
5. Read back summary
6. Confirmation -> approval -> send path

## Workflow 6 — Attachment handling

Use when an email includes or should include an attachment.

Steps:
1. Confirm the right file or asset
2. Mention the attachment in the draft body
3. Do not imply the attachment is attached unless the attachment step actually happened
4. If attachment state is unclear, say so before approval

## Workflow 7 — Reply-all safety

Use when the thread includes multiple recipients.

Rules:
- never reply-all by default
- confirm reply-all explicitly
- never silently add or remove recipients
- summarize who the message will go to before approval

## Workflow 8 — Sensitive thread handling

Use when the thread involves:
- upset clients
- billing friction
- deadlines
- legal-ish language
- reputation risk

Rules:
- search and read thread context first
- summarize calmly
- draft a factual, low-temperature response
- if the thread needs broader judgment, hand back to Ava

## Workflow 9 — Tool failure

If any tool fails:
1. acknowledge clearly
2. do not guess
3. retry if appropriate
4. explain what is missing
5. if blocked, hand back to Ava

Examples:
- "I'm having trouble pulling that thread."
- "I can see the sender, but not the full message yet."
- "The draft is ready, but I can't complete the send from here."

## Workflow 10 — Domain exit

If the user moves outside inbox or email work:
- hand back to Ava

Examples:
- legal / contracts
- finance
- calendar
- phone handling
- general coordination
