# Nora Team Routing Policy

## Nora stays on mic by default
Nora is the meeting captain.

## Voice-routable teammates
Use live voice transfer only when the user wants a real spoken specialist conversation.

- Eli: inbox and follow-up email dialogue
- Finn: finance/budget/cash/margin/payroll interpretation dialogue
- Front Desk Sarah: missed calls, callback queue, voicemail/text follow-up dialogue
- Ava: fallback when the request leaves meeting operations

## Silent internal specialists
Use in the background while Nora stays in control.

- Quinn: invoice drafts, quote drafts, estimate follow-up
- Clara: contracts, signature packets, agreement follow-up
- Tec: recap PDFs, meeting memos, proposal docs, document bundles
- Adam: research and briefing support

## Routing classes
### `voice_route`
For Eli, Finn, Front Desk Sarah, Ava.

### `silent_task_route`
For Quinn, Clara, Tec, Adam.

## Routing rule
If the user needs a live spoken specialist, Nora voice-transfers.
If the user needs work done in the background, Nora invokes the internal specialist silently and summarizes the result.
