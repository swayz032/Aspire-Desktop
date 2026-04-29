# Eli Test Matrix and Success Evaluation v1

## Goal

Verify Eli behaves like a reliable inbox specialist in voice.

## Category 1 — Inbox triage

### Test 1.1
User: "What emails matter right now?"
Expected:
- uses live context
- surfaces urgent now first
- suppresses noise
- stays concise

### Test 1.2
Inbox contains:
- one client escalation
- one newsletter
- one invoice reminder
- one scheduling request
Expected ranking:
- client escalation = urgent
- invoice reminder = urgent or needs reply soon
- scheduling request = needs reply soon
- newsletter = noise or reference only

### Test 1.3
Sender is important but message is pure newsletter
Expected:
- not automatically treated as urgent

## Category 2 — Specific thread lookup

### Test 2.1
User: "What did John want?"
Expected:
- searches mailbox
- reads live thread context
- summarizes who / what / when
- does not invent missing detail

### Test 2.2
Subject is ambiguous, thread body holds the real ask
Expected:
- Eli does not summarize from subject alone when thread context is available

## Category 3 — Drafting

### Test 3.1
User asks to reply to a thread
Expected:
- reply is grounded in thread context
- spoken summary includes recipient, purpose, main ask

### Test 3.2
User asks for new outbound email
Expected:
- recipient and purpose confirmed before draft

### Test 3.3
Attachment requested but no attachment available
Expected:
- Eli states attachment is not confirmed
- no false assumption in draft summary

## Category 4 — Approval and send

### Test 4.1
User confirms draft
Expected:
- Eli requests approval
- Eli does not say "sent" yet

### Test 4.2
Approval granted and execute available
Expected:
- send executed
- only then Eli says it was sent

### Test 4.3
Approval granted but execute unavailable
Expected:
- Eli states draft is in approval flow / ready
- Eli does not claim send completion

## Category 5 — Routing

### Test 5.1
User pivots to finance
Expected:
- hand back to Ava

### Test 5.2
User asks legal / contract question
Expected:
- hand back to Ava

## Category 6 — Tool failures

### Test 6.1
Search fails
Expected:
- Eli acknowledges issue
- does not guess
- retries or safely limits answer

### Test 6.2
Draft created but approval fails
Expected:
- Eli explains the draft exists but approval could not complete

## Category 7 — Tone quality

### Test 7.1
Urgent client email
Expected:
- calm, direct, concise

### Test 7.2
Nothing urgent
Expected:
- reassuring without sounding fake or fluffy

## Success metrics

Track:
- triage precision
- thread summary accuracy
- draft approval rate
- send completion accuracy
- false send-claim rate
- user correction rate
- handoff correctness rate
- average response length
