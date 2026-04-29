# Backend Alignment Notes

## Update required
- Replace any old payroll/Milo routing with Finn, the Finance Hub Manager.
- Add Nora -> Adam research trigger support.
- Add Office Inbox post-meeting hook.
- Add Office Memory promotion path.
- Keep Quinn scoped to invoice/quote only.
- Keep payment execution language out of Nora.

## Tool abstraction rule
Expose simple Nora voice tools in ElevenLabs and map them server-side to conference-specific backend actions.

## Team routing rule
- voice_route: Eli, Finn, Front Desk Sarah, Ava
- silent_task_route: Quinn, Clara, Tec, Adam
