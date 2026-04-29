# Claude Code Implementation Plan

## Phase 1: baseline runtime alignment
- Install Nora prompt
- Add dynamic variables
- Map simple voice tools to backend conference actions
- Pass `meeting_purpose` and `recording_mode` from Start Session

## Phase 2: modern meeting behavior
- Implement organizer-controlled start policy
- Wire Option A transcript architecture
- Build structured recap packet generation
- Add Office Inbox posting and Office Memory save paths

## Phase 3: team and purpose intelligence
- Add team routing policy
- Add silent specialist invocation
- Add voice transfer to Eli, Finn, Front Desk Sarah, Ava
- Add Adam briefing and recap enrichment triggers
- Add purpose-aware recap and routing changes
- Add authority lane integration

## Engineering requirements
- idempotent actions
- clear approval gates
- receipt linkage for state changes
- tenant-safe routing
- no fake execution confirmations
