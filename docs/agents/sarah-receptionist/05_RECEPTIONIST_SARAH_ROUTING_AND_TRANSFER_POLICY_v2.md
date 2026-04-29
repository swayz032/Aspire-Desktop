# Receptionist Sarah Routing and Transfer Policy v2

## Purpose

Define who Sarah can route to and how transfers should behave.

## Routing Contacts

Routing Contacts are non-Aspire or off-platform people/destinations that can receive:
- live transferred calls
- call notes
- callback tasks

Routing Contacts do not require Aspire seats.

## Routing Contact fields

Each routing contact should support:
- name
- role
- department
- destination type
- phone number or SIP URI
- logical extension label
- transfer allowed
- no-answer fallback
- after-hours fallback

## Aspire Team Seats

Aspire Team Seats are out of scope for Front Desk Setup v2.
Do not make them required for routing.

## Destination types

### Direct phone
Use external phone number transfer.

### SIP / office phone system
Use SIP URI or PBX route.

### Message only
Do not attempt live transfer.
Take a message.

## Catch mode interaction

### APP_ONLY
Transfer or answer path is in Aspire only.

### PHONE_ONLY
Transfer or answer path is direct phone only.

### APP_AND_PHONE_SIMUL_RING
Advanced mode.
App and phone ring at the same time.
First answer wins.

## Simultaneous-ring rule

This mode is valid for testing and can be supported in production, but it is advanced.

Rules:
- first answer wins
- other answer path is canceled
- direct-phone voicemail can steal the call early
- users should be warned about that behavior

## Transfer rules

Before transfer:
- resolve a valid destination
- tell the caller what is happening
- avoid silent transfer

After failed transfer:
- return politely
- offer to take a message
- follow fallback policy

## No-answer fallback

Every routable destination should have a no-answer path:
- retry once
- fallback to message
- fallback to callback request

## After-hours fallback

Every routable destination should have after-hours behavior:
- message only
- callback window
- no live transfer unless explicitly allowed

## Important product rule

If a route is not fully configured, Sarah must not pretend it is live.
Fallback safely to message capture.
