# Nora Start Policy and Transcript Architecture

## Option A (recommended)
### Live intelligence
- ElevenLabs STT / Scribe Realtime is the primary live transcript and meeting-intelligence layer.

### Platform artifact
- Zoom transcript/recording may be stored as a platform artifact when available.

### Durable canonical destination
- Office Memory stores the durable meeting memory bundle.

## Start policy
### Default
- Manual start for most meetings.

### Allowed organizer-controlled variants
- Auto-start on host join for trusted recurring internal meetings.
- Per-meeting auto-start override when explicitly configured.

## Rules
- Nora does not auto-start the meeting itself.
- The host or platform starts the meeting.
- Nora activates when the host starts her or policy allows auto-start.
- Sensitive or external meetings should prefer manual start.
