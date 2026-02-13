# Aspire Desktop

## Overview
Aspire Desktop is a full-featured virtual office platform built with Expo (React Native for Web). It provides AI-powered business tools including voice sessions with Ava, financial management via Finance Hub (Finn Desk), office store for AI staff management, booking/scheduling, and inbox management. The platform aims to offer a comprehensive solution for modern businesses, integrating AI to streamline operations and enhance productivity.

## User Preferences
I prefer iterative development with a focus on clear communication. Please ask before making major architectural changes or implementing new features. I appreciate detailed explanations of complex technical decisions. I also prefer that you use simple language wherever possible.

## System Architecture
The platform utilizes Expo/React Native Web with expo-router for the frontend, an Express.js server for the backend, and PostgreSQL with Drizzle ORM for database management. The build process involves `expo export -p web` to generate static files served by Express.

**UI/UX Decisions:**
- Dark theme with glassmorphism for Finance Hub components.
- Enterprise-grade SVG patterns for hero banners and UI elements (e.g., financeDashboard, pulseWave, hexGrid).
- Fully vector-rendered components like DocumentThumbnail for crisp, scalable visuals.
- Professional, styled HTML for documents like paystubs.
- Unified panel management for header dropdowns (notifications, profile) with click-outside-to-close functionality.

**Technical Implementations:**
- **Ava Desk**: AI assistant with voice and video modes.
- **Finance Hub**:
    - Enterprise-grade event-sourced finance tracking.
    - Webhook ingestion for external providers with signature verification (Plaid JWT, Stripe signature, QBO HMAC, Gusto HMAC).
    - Snapshot engine aggregating finance events into five chaptered story sections: NOW, NEXT, MONTH, RECONCILE, ACTIONS.
    - API endpoints for snapshot, timeline, explanation, lifecycle, connections status, and governed actions.
    - UI components: `SourceBadge`, `ExplainDrawer`, `TimelineRow`, `ReconcileCard`, `LifecycleChain`.
    - Compliance features: Explicit consent screens (e.g., Plaid consent), MFA, and dedicated legal/security pages.
    - Finance Hub Books page with "Money Shelves" (department tiles), "Money Moves" (guided journal entry wizard), and "Money Trail" (timeline-grouped GL data).
- **Office Store**: Manages AI staff members.
- **Session**: Supports voice sessions, video calls, and conference rooms.
- **Founder Hub**: Provides daily briefs, educational content, and notes.
- **Bookings**: Service scheduling system integrated with financial tracking.
- **Inbox**: Business email and message management.
- **Plaid Compliance Patch**: Implemented legal pages, clean public URLs, explicit consent, security practices disclosure, and gated Plaid connection.

**System Design Choices:**
- Tenant-scoped database tables for financial data.
- Append-only event store (`finance_events`) with idempotency.
- Encrypted OAuth tokens with rotation versioning.
- Chaptered story approach for financial snapshots to provide contextual information.
- Trust Spine audit trail for all operations, including governed actions.
- Dynamic loading of third-party SDKs (e.g., Plaid Link SDK) with proper cleanup.
- Error boundary wrappers for critical sections like Finance Hub.
- Connection-aware UI elements with appropriate empty states.

## External Dependencies
-   **Plaid**: For banking connections and transaction data.
-   **Stripe**: For payment processing and payouts.
-   **QuickBooks (Intuit)**: For accounting data and integrations.
-   **Gusto**: For payroll processing and employee management.
-   **ElevenLabs**: For AI voice generation.
-   **otplib**: For MFA (TOTP) generation and verification.
-   **qrcode**: For QR code generation in MFA.