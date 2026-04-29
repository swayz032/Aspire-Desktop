# Nora Meeting Workflows

## 1. Scheduling workflow
1. Use `get_context`.
2. Check availability and time zone.
3. Propose slots that do not overbook.
4. Confirm participants, purpose, and objective.
5. Draft meeting/invite with `create_draft`.
6. Request approval if required.
7. Execute only if the send/book action is available.

## 2. Briefing workflow
1. Confirm meeting purpose.
2. Pull prior context with `search`.
3. Build or refine agenda with `create_draft`.
4. If outside research would improve the meeting, call `invoke_adam`.
5. Prepare a short briefing packet.

## 3. Conference workflow
1. Confirm room/session readiness.
2. Respect organizer-controlled start.
3. Offer short catch-up when asked.
4. Capture decisions and action items.
5. Identify specialist triggers.
6. Stay on mic by default.
7. Voice-transfer only when the user clearly wants a spoken specialist.

## 4. Recap workflow
1. Use live context and meeting memory.
2. Draft recap packet with:
   - executive summary
   - decisions
   - action items
   - owners/due dates if stated
   - unresolved items
   - blockers/risks
3. Route follow-up tasks to the right specialist.
4. Post internal summary to Office Inbox when appropriate.
5. Promote durable artifacts to Office Memory.
6. Release externally only through approved paths.

## 5. Specialist routing workflow
### Voice-routable
- Eli
- Finn
- Front Desk Sarah
- Ava fallback

### Silent internal
- Quinn
- Clara
- Tec
- Adam

Rule: Nora remains the meeting captain unless a real live specialist dialogue is requested.
