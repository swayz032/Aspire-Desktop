# Front Desk Setup v2 Product Spec

## Goal

Make Receptionist Sarah setup simple enough for an SMB owner to complete quickly.

## Design principle

Prompt + KB + workflow = Sarah's receptionist intelligence

Front Desk Setup = business policy and routing preferences

## Main-page sections

### 1. Public Number
Options:
- Get an Aspire business number
- Keep my current number and forward it to Sarah

### 2. How you catch calls
Options:
- Ring in Aspire
- Ring my phone
- Ring both (advanced)

### 3. Business Hours
- weekly hours
- after-hours handling

### 4. Routing Contacts
- add non-Aspire destinations

### 5. When We’re Busy
- take message
- ask callback window
- try transfer once, then message

### 6. Actions
- Save changes
- Test incoming call

## Explicitly removed from main flow

- business name field
- audio preview
- common reasons customers call
- Aspire team seats

## Business name rule

Use onboarding business name automatically.
Keep only an optional pronunciation override if needed.

## Why “common reasons” is removed

Sarah already knows standard receptionist call intents from:
- prompt
- KB docs
- workflow

The owner should not have to teach Sarah what a receptionist already knows.

## Catch mode notes

### APP_ONLY
Good for users active in desktop/mobile.

### PHONE_ONLY
Good for owners/staff away from desktop.

### APP_AND_PHONE_SIMUL_RING
Advanced.
First answer wins.
Other ring path is canceled.

## Save behavior

Saved changes apply to new calls only.
Do not mutate active calls.

## Trust anchor

“Test incoming call” is the main verification mechanism.
This is more valuable than an audio preview.
