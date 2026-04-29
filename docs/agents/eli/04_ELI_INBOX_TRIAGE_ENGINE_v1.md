# Eli Inbox Triage Engine v1

## Purpose

This document defines how Eli separates important email from noise.

Eli must not decide importance by vibe.
Eli must use a multi-signal ranking model.

## Triage buckets

Every inbound thread belongs in one of five buckets:

1. Urgent now
2. Needs reply soon
3. Waiting on someone else
4. Reference only
5. Noise

## Core principle

Important email = action + consequence  
Noise = no action + no meaningful consequence

## Signals Eli should inspect

### Sender importance
Raise priority when sender is:
- active client
- high-value lead
- accountant
- payroll provider
- bank or payment provider
- vendor tied to active work
- government, legal, or compliance contact
- internal VIP / founder-critical contact

Lower priority when sender is:
- newsletter
- promo list
- bulk announcement
- cold outreach
- non-actionable digest

### Subject line / title signals
Raise priority when subject includes signals like:
- action required
- approval needed
- signature needed
- invoice
- overdue
- payment failed
- proposal
- revised estimate
- urgent
- today
- by Friday
- meeting moved
- response needed

Lower priority when subject looks like:
- newsletter
- weekly digest
- promotion
- announcement
- webinar
- roundup
- no-reply updates with no consequence

### Body keyword signals
Raise priority when body includes:
- please review
- confirm
- approve
- sign
- due
- overdue
- follow up
- waiting on
- blocked
- payment
- invoice
- contract
- schedule
- deadline

Lower priority when body is clearly:
- promotional
- informational only
- automated digest
- mass market outreach

### Thread state
Raise priority when:
- owner owes the next reply
- thread is unread and unresolved
- there are multiple back-and-forth messages with no resolution
- prior promise exists and no follow-up was sent
- thread is aging without a response

### Relationship risk
Raise priority when:
- client is upset
- tone is deteriorating
- expectation mismatch appears
- missed deliverable or delay is being called out
- reputation risk is visible

### Money / operational impact
Raise priority when email affects:
- invoices
- collections
- billing issues
- failed payments
- payroll or provider notices
- quotes / estimates
- active project blockers
- approvals needed to keep work moving

### Bulk / noise clues
Lower priority when email includes:
- unsubscribe footer
- generic campaign language
- clearly templated mass mail
- generic sales blast
- digest formatting
- no action needed and no consequence

## Recommended weighted model

### High-weight positive signals
- money / collections / billing issue: +30
- client escalation or unhappy tone: +25
- explicit deadline inside 24 hours: +25
- approval / signature needed: +20
- owner is next to respond: +20
- active client or VIP sender: +15

### Medium-weight positive signals
- vendor tied to active project: +10
- calendar / scheduling request: +10
- follow-up older than two business days: +10
- active project blocker: +10
- revised quote / proposal request: +10

### Negative signals
- newsletter / promo clues: -25
- unsubscribe / bulk campaign pattern: -20
- automated digest with no action: -15
- receipt or confirmation only: -10

### Bucket thresholds
- 50 and above = Urgent now
- 30 to 49 = Needs reply soon
- 15 to 29 = Waiting / reference review
- 0 to 14 = Reference only
- below 0 = Noise

## Hard rules

- No single signal should decide priority when deeper thread context is available
- Subject-line scanning is required, but subject alone is not enough when the thread can be read
- Money threads are never treated as pure noise without inspection
- Legal / compliance / government mail gets protected review
- Repeated unanswered client threads rise in priority over time
- Sender importance alone is not enough; action and consequence matter

## Spoken summary rule

Eli should not read the inbox line by line.
Eli should summarize the result of triage.

Good example:
- "You've got twelve new emails. Two matter now: one client deadline and one invoice issue. Three need replies soon. The rest are either waiting or noise."

## Escalation rule

If the inbox pattern shows relationship, legal, or broader operational complexity outside normal email handling:
- hand it back to Ava
