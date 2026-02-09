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
- `components/finance/` - Finance Hub UI components (SourceBadge, ExplainDrawer, TimelineRow, ReconcileCard, LifecycleChain)
- `server/` - Express backend (API routes, database, integrations, webhook handlers)
- `data/` - Mock data and static data files
- `assets/` - Images, avatars, fonts, AI staff videos
- `public/` - Static files served directly (videos, HTML)
- `dist/` - Built output from expo export
- `lib/` - Utility libraries and stores
- `providers/` - React context providers
- `types/` - TypeScript type definitions

## Key Features
- **Ava Desk**: AI assistant with voice and video modes (3D orb video at `/ava-orb.mp4`)
- **Finance Hub**: Enterprise-grade event-sourced finance tracking with webhook ingestion, snapshot computation, reconciliation, lifecycle chain, and governed actions
- **Office Store**: AI staff members (Clara, Eli, Nora, Quinn, Sarah) with intro videos
- **Session**: Voice sessions, video calls, conference rooms
- **Founder Hub**: Daily brief, education, library, notes, etc.
- **Bookings**: Service scheduling system
- **Inbox**: Business email/message management

## Finance Hub Architecture (Enterprise)

### Database Tables (Drizzle ORM, tenant-scoped)
- `finance_connections` - Provider connections (Plaid, Stripe, QBO, Gusto) with status tracking
- `finance_tokens` - Encrypted OAuth tokens with rotation versioning
- `finance_events` - Append-only event store, normalized across providers, idempotent via unique constraint (suite_id, office_id, provider, provider_event_id)
- `finance_entities` - Entity metadata and CDC cursors
- `finance_snapshots` - Computed snapshot cache with chaptered story
- `receipts` - Trust Spine audit trail for all operations

### Webhook Handlers (Signature-Verified)
- `server/plaidWebhookHandler.ts` - Plaid JWT verification, transactions/sync pull, balance fetch
- `server/stripeFinanceWebhook.ts` - Stripe signature verification (raw body), payout reconciliation, settlement tracking, fee extraction
- `server/qboWebhookHandler.ts` - QuickBooks HMAC-SHA256, CDC polling fallback, report fetching
- `server/gustoWebhookHandler.ts` - Gusto HMAC verification, company token refresh (2hr expiry), payroll data fetch

### Snapshot Engine (`server/snapshotEngine.ts`)
Aggregates finance_events into 5 chaptered story sections:
- **NOW** - Cash truth (bank + Stripe balances)
- **NEXT** - 7-14 day cash flow projection
- **MONTH** - Revenue/expense performance
- **RECONCILE** - Mismatch detection (settlement timing, payout matching, cash vs books, missing entries)
- **ACTIONS** - AI-generated proposals with risk assessment

### API Endpoints
- `GET /api/finance/snapshot` - Chaptered story with auto-refresh (5min staleness)
- `GET /api/finance/timeline` - Paginated event feed
- `GET /api/finance/explain` - Per-metric provenance explanation
- `GET /api/finance/lifecycle` - Money flow chain (Booked→Invoiced→Paid→Deposited→Posted)
- `GET /api/connections/status` - Provider connection health
- `POST /api/finance/compute-snapshot` - Force snapshot recomputation
- `POST /api/finance/proposals` - Create governed action proposals
- `POST /api/finance/actions/execute` - Execute with Trust Spine policy evaluation

### Finance UI Components
- `SourceBadge` - Provider attribution with confidence indicator
- `ExplainDrawer` - Bottom sheet with metric provenance details
- `TimelineRow` - Event feed row with provider icons and amounts
- `ReconcileCard` - Mismatch card with severity, amounts, next steps
- `LifecycleChain` - Horizontal stepper showing money flow stages

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
- **Legal Pages**: Enterprise-grade Privacy Policy, Terms of Service, Data Retention & Deletion pages at `/more/privacy-policy`, `/more/terms`, `/more/data-retention`
- **Clean Public URLs**: Top-level routes at `/privacy`, `/terms`, `/data-retention` for Plaid questionnaire links
- **Plaid Consent**: Explicit consent screen at `/more/plaid-consent` with accept/revoke controls
- **Security Practices**: Provider-specific security details (Plaid SOC2, Stripe PCI-DSS, QuickBooks/Gusto) at `/more/security-practices`
- **Policies Hub**: Updated `/more/policies` with links to all legal pages, consent, and security
- **Plaid Gating**: `connectPlaid()` in connections.tsx requires consent + MFA before opening Plaid Link
- **Security Libraries**: `lib/security/storage.ts`, `lib/security/plaidConsent.ts`, `lib/security/mfa.ts`
- **Dependencies**: Added `otplib`, `qrcode`, `@types/qrcode`
- **Third-Party Providers Disclosed**: Plaid, Stripe, QuickBooks (Intuit), Gusto — with data types, purposes, locations, and user controls
- **Contact Email**: security@aspireos.app (standardized across all pages)

## Recent Changes (Feb 9, 2026 - Latest)
- Built enterprise Finance Hub backend with event-sourced architecture
- Created 6 tenant-scoped finance database tables with idempotency constraints
- Implemented webhook ingestion for all 4 providers (Plaid JWT, Stripe signature, QBO HMAC, Gusto HMAC)
- Built snapshot computation engine with 5 chaptered story sections and provenance tracking
- Created ReconcileCard rendering with mismatch detection (settlement timing, payout matching, cash vs books)
- Built LifecycleChain component showing money flow (Booked→Invoiced→Paid→Deposited→Posted)
- Added event timeline rendering with TimelineRow component
- Implemented governed actions (proposals + execute) with Trust Spine policy evaluation
- Added auto-refresh snapshot (5min staleness threshold)
- Created lifecycle API with entity-scoped filtering
- All webhook handlers use idempotent event writes (ON CONFLICT DO NOTHING)
- Trust Spine receipts created for all operations (ingest, compute, propose, execute)
- Replaced MFA window.alert() with premium-styled inline modal (setup + verify modes with TOTP code input)
- Replaced full-page Plaid consent navigation with inline premium consent modal
- Both modals match Finance Hub dark theme (CARD_BG, glassmorphism, same pattern as Gusto setup modal)
- Fixed otplib v6 API usage (generateSecret/verify top-level exports instead of deprecated authenticator)
- Plaid connect flow now chains: Consent modal → MFA modal → Plaid Link (no page navigation or browser alerts)
- Fixed blank Finance Hub screen: null.toLocaleString() crash in LifecycleChain when amount is null
- Added null safety to all currency formatting functions (formatCurrency, formatShortCurrency, ReconcileCard)
- Gated lifecycle and timeline sections behind isConnected check (connection-aware UI)
- Added error boundary wrapper to Finance Hub to prevent future blank screens
- Fixed Plaid white screen hang: dynamically loads Plaid Link SDK (link-initialize.js) instead of broken popup fallback
- Memoized SDK load promise to prevent duplicate script injection
- Proper cleanup of intervals/timeouts in SDK loader to avoid unhandled rejections
- Loading state now clears correctly on Plaid success, exit, or error
- Created server/initialSync.ts: registers finance_connections and pulls initial data from all 4 providers into finance_events table with idempotency
- Updated Finance Hub overview UX: added Chapters section (Now/Next/Month/Trust), provider cards show real snapshot data with SourceBadges, KPI cards tappable for ExplainDrawer, live TimelineRow feed replaces static transactions
- Connection-aware empty states implemented: no fake numbers shown when providers disconnected (all fallbacks use em-dash "—")
- All KPI cards now open ExplainDrawer on tap with metricId mapping
- SourceBadge added to Total Balance card (shows "Computed" + staleness), and to each provider card (Plaid/QuickBooks/Gusto)
- Timeline section shows TimelineRow components when real events exist, otherwise shows connection-aware empty state
- Removed duplicate standalone EVENT TIMELINE section from Finance Hub overview (kept inline feed in Recent Transactions card)
- Added 7 new enterprise-grade SVG patterns: financeDashboard, pulseWave, hexGrid, isometricBlocks, flowLines, circuitBoard
- Applied financeDashboard SVG pattern to Finance Hub hero banner (right side, 55% width) with dual radial gradients
- Added missing Gusto SDK routes: PUT /compensations/:id, GET/POST /jobs/:jobId/compensations, PUT /employees/:uuid/onboarding-status, PUT /departments/:uuid, PUT /locations/:uuid, PUT /payrolls/:uuid/submit
- Fixed Run Payroll for Gusto SDK accuracy: two-phase submit (Governance Proposal → Gusto Submit API), compensation rate update API, real activePayroll dates in submit/receipt sections
- Expanded Add Employee form with job title, pay type (Hourly/Salary toggle), rate, and department fields — wires job + compensation creation via Gusto API
- Added always-available Print Paystub button (window.open + window.print) with professional styled HTML paystub layout
- Deep scanned all 7 payroll subpages — no critical runtime errors found
