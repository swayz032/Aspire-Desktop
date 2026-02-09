# Aspire Desktop

## Overview
Aspire Desktop is a full-featured virtual office platform built with Expo (React Native for Web). It provides AI-powered business tools including voice sessions with Ava, financial management via Finance Hub (Finn Desk), office store for AI staff management, booking/scheduling, inbox management, and more.

## Architecture
- **Frontend**: Expo/React Native Web with expo-router for navigation
- **Backend**: Express.js server (server/index.ts) serving built static files + API routes
- **Database**: PostgreSQL via Drizzle ORM
- **Build**: `expo export -p web` builds to `dist/`, then Express serves from `dist/` and `public/`
- **Port**: Server runs on port 5000

## Key Directories
- `app/` - Expo Router pages (tabs, finance-hub, office-store, session, founder-hub, etc.)
- `components/` - Reusable React components
- `server/` - Express backend (API routes, database, integrations)
- `data/` - Mock data and static data files
- `assets/` - Images, avatars, fonts, AI staff videos
- `public/` - Static files served directly (videos, HTML)
- `dist/` - Built output from expo export
- `lib/` - Utility libraries and stores
- `providers/` - React context providers
- `types/` - TypeScript type definitions

## Key Features
- **Ava Desk**: AI assistant with voice and video modes (3D orb video at `/ava-orb.mp4`)
- **Finance Hub**: Finn Desk (AI finance assistant), invoices, cash position, payroll, books, etc.
- **Office Store**: AI staff members (Clara, Eli, Nora, Quinn, Sarah) with intro videos
- **Session**: Voice sessions, video calls, conference rooms
- **Founder Hub**: Daily brief, education, library, notes, etc.
- **Bookings**: Service scheduling system
- **Inbox**: Business email/message management

## Build & Run
- `npm run web` - Full build and serve (builds expo web + starts Express server)
- `npm run web:build` - Build only (expo export + viewport fix)
- `npm run web:serve` - Start server only

## Integrations
- Plaid (banking connections)
- Stripe (payments)
- QuickBooks (accounting)
- Gusto (payroll)
- ElevenLabs (AI voice for Finn)

## Plaid Compliance Patch
- **Legal Pages**: Privacy Policy, Terms of Service, Data Retention & Deletion pages at `/more/privacy-policy`, `/more/terms`, `/more/data-retention`
- **Clean Public URLs**: Top-level routes at `/privacy`, `/terms`, `/data-retention` for Plaid questionnaire links
- **Plaid Consent**: Explicit consent screen at `/more/plaid-consent` with accept/revoke controls
- **Security Practices**: Factual security overview at `/more/security-practices` (no overclaims)
- **Policies Hub**: Updated `/more/policies` with links to all legal pages, consent, and security
- **Plaid Gating**: `connectPlaid()` in connections.tsx requires consent + MFA before opening Plaid Link
- **Security Libraries**: `lib/security/storage.ts`, `lib/security/plaidConsent.ts`, `lib/security/mfa.ts`
- **Dependencies**: Added `otplib`, `qrcode`, `@types/qrcode`

## Recent Changes (Feb 9, 2026)
- Implemented Plaid compliance patch (legal pages, consent gating, security practices)
- Imported full Aspire-Desktop project from zip
- Placed 3D object video (ava-orb.mp4) for Ava voice session and Finn desk
- Added AI staff intro videos (Clara, Eli, Nora, Quinn, Sarah) to office store
- Configured for desktop web mode on port 5000
- Set up PostgreSQL database
- Fixed dependency issues (expo-modules-core, react-native-gesture-handler)
