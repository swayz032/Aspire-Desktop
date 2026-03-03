# Aspire Desktop

## Overview
Aspire Desktop is a full-featured virtual office platform built with Expo (React Native for Web). It provides AI-powered business tools including voice sessions with Ava, financial management via Finance Hub (Finn Desk), office store for AI staff management, booking/scheduling, and inbox management. The platform aims to offer a comprehensive solution for modern businesses, integrating AI to streamline operations and enhance productivity.

## User Preferences
I prefer iterative development with a focus on clear communication. Please ask before making major architectural changes or implementing new features. I appreciate detailed explanations of complex technical decisions. I also prefer that you use simple language wherever possible.

## Dev Auth Bypass
Auth is automatically bypassed when Supabase credentials are not configured (no `EXPO_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` env vars). The bypass is environment-driven and will never activate in production (`NODE_ENV=production`).

Files involved:
- `providers/SupabaseProvider.tsx` — provides a fake session with dev user/suite IDs
- `app/_layout.tsx` — skips the auth gate redirect and onboarding check
- `server/index.ts` — skips JWT verification in the middleware, sets RLS context
- `lib/supabase.ts` — uses placeholder Supabase URL/key to prevent crash when env vars are missing

To re-enable real auth, set the Supabase environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

## System Architecture
The platform utilizes Expo/React Native Web with expo-router for the frontend, an Express.js server for the backend, and PostgreSQL with Drizzle ORM for database management. The build process involves `expo export -p web` to generate static files served by Express.

**Canvas Widget Modal Architecture (Wave 16 Rebuild):**
- `WidgetModal` is now a **bare transparent scaffold** — no glass, no header, no title bar. Card has `backgroundColor: 'transparent'`, `overflow: 'hidden'`, `borderRadius: 20`. Only provides: dark blurred backdrop, spring entrance animation, floating × close button (top:14, right:14, rgba(0,0,0,0.45)).
- All 11 canvas widgets own their own full-bleed backgrounds, headers, and visual identity. No glass containers, no generic layouts.
- Removed props from WidgetModal: `title`, `accent`, `icon`, `noteColor`, `hideHeader`, `noScroll`. New interface: `{ visible, onClose, children, size? }`.
- Each widget has ONE unforgettable visual element (see plan in `.local/session_plan.md`).
- Widget backgrounds: Agent=`#000`, StickyNote=vivid paper color, TodaysPlan=`#070A10`, Email=`#080D14`/`#06090F`, TextMessage=`#08090F`, Phone=navy LinearGradient, Finance=`#050A12`, Calendar=`#060A10`, Receipts/Quote/Contract/AuthorityQueue=`#060A10`.

**UI/UX Decisions:**
- Dark theme with glassmorphism for Finance Hub components.
- Enterprise-grade SVG patterns for hero banners and UI elements (e.g., financeDashboard, pulseWave, hexGrid).
- Fully vector-rendered components like DocumentThumbnail for crisp, scalable visuals.
- Professional, styled HTML for documents like paystubs.
- Unified panel management for header dropdowns (notifications, profile) with click-outside-to-close functionality.
- LED ambient color-cycling animations on Finance Hub icons, section labels, and Finn pill using CSS keyframe animations with staggered delays.
- Finn card: Premium LED pill above orb (clickable to start voice session), chat button bottom-right, concentricRings SVG background pattern, glass overlay on orb.
- SVG icons in EnterpriseIcon use currentColor with CSS overrides for LED animation inheritance.

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
- **Inbox**: Business email and message management with redesigned premium UI.
    - Aspire dark glass aesthetic throughout (dark surfaces, glassmorphism, blue accent).
    - Finn floating avatar FAB (bottom-right) with popup selector for Compose and Eli Chat.
    - Compose and Eli Chat open as separate standalone modals from Finn selector.
    - CC/BCC support in compose, file attachment picker (web), type-coded attachment display.
    - Debounced search bar for finding older messages beyond 30-item inbox cap.
    - Filter pills wired to real Gmail API labels: Sent (SENT), Drafts (DRAFT), Junk (SPAM) via `?label=` param.
    - `labelResults` state for label-filtered mail; resets on tab change and mailbox switch.
    - HTML email rendering via sandboxed iframe with dark style injection and postMessage height reporting.
    - Sent message card styling: cyan arrow icon, "To: recipient" preview, "Sent" label, blue-tint left border.
    - `labelIds` added to MailThread server response for client-side sent detection.
    - Premium detail views for all 4 types (Office, Calls, Mail, Contacts).
    - Fixed `formatEmailContent` stripping invisible HTML entities (`&zwnj;`, zero-width chars, soft hyphens).
    - Attachment download route: `GET /api/mail/attachments/:messageId/:attachmentId`.
    - EliVoiceChatPanel redesigned with ElevenLabs voice-chat-01 aesthetic: animated pulsing orb, shimmering status text, custom message bubbles with copy-on-hover, text input + voice toggle footer, triage count display, close button.
- **Mailbox Setup**:
    - Refactored to `/v1/*` OpenAPI contract with `lib/mailApi.ts` adapter layer (13 functions).
    - jobId-based resumable onboarding with sessionStorage persistence (wizard resumes from server after page refresh).
    - Buy Domain flow: search bar, availability display, pricing, tenant Request Purchase vs operator Proceed to Checkout, purchase status tracking (PENDING_APPROVAL, PROCESSING, COMPLETED).
    - Enhanced BYOD DNS flow with Check DNS button, per-record PASS/FAIL status, observed values display, lastChecked timestamp.
    - Setup Summary panel displays live draft inputs (domainInput, mailboxInput) before server commit.
    - Server stub routes at `/v1/*` with in-memory stores, jobId-scoped receipts, deterministic domain search, mock DNS checks.
    - Operator vs Tenant context via IS_OPERATOR flag.
- **Plaid Compliance Patch**: Implemented legal pages, clean public URLs, explicit consent, security practices disclosure, and gated Plaid connection.

- **Canvas Mode (3D Workspace)**:
    - Floating 3D slab design: dark void (#0D0D0D) behind, rounded corners (16px), visible edge thickness (bottom/right faces), multi-layer box-shadow depth.
    - Workspace tokens in `constants/tokens.ts` Canvas.workspace block: behindBg, surfaceRadius, edgeThickness, edgeColor, outerShadow, perspective, margin per breakpoint, minHeight.
    - Duplicate workspace tokens in `constants/canvas.tokens.ts` CanvasTokens.workspace for parity.
    - Responsive margin: 20px (wide), 16px (desktop), 12px (laptop), 8px (tablet).
    - Chat sub-mode uses ScrollView for scrollable content; Canvas sub-mode uses overflow-visible View for drag widgets.
    - Cursor spotlight: radial gradient follows mouse on web with RAF-throttled mousemove.
    - Inner shadows increased to 0.05-0.18 opacity for stronger sunken feel.
    - CanvasGrid and VignetteOverlay clipped with borderRadius: 16 to match surface corners.
    - VignetteOverlay uses position: absolute (not fixed) since it's inside the clipped surface.
    - **3D Shelf Dock**: Solid opaque `#1C1C1E` background (not glassmorphism), 18px surfaceRadius, visible 4px bottom/right edge thickness, multi-layer box-shadow, top highlight bevel, responsive margin sync with canvas slab.
    - **Premium App Icons**: 56px squircle tiles (borderRadius: 14) with per-widget gradient backgrounds (blue/green/cyan/red/orange/emerald/violet/amber/yellow/indigo), bold 28px white SVG symbols, inner highlight overlay, individual drop shadows.
    - **Dock tokens**: `CanvasTokens.dock` (size, radius, shadows, edge) + `CanvasTokens.iconGradients` map in `constants/canvas.tokens.ts`.
    - **Icon animations**: Hover lifts icon -8px with scale 1.08 + tooltip label; press pushes +2px with scale 0.92; drag fades to 0.4; staggered entrance with 35ms delay per icon.
    - **Active widget dots**: 5px white dot below dock icon when widget is placed on canvas, derived from `placedWidgets` state.
    - **AI Voice Agent Icons**: Ava (Aspire Blue), Eli (Amber/Gold), Finn (Finance Purple) appended after tool icons with vertical divider. Photo-based squircle avatars with gradient glow border ring, glass highlight, pulsing glow when voice active. Non-draggable (tap to toggle voice session). Defined in `AGENT_WIDGETS` constant.
    - **Drag-and-Drop**: Custom pointer-based drag system (NOT dnd-kit) for dock-to-canvas. `onPointerDown` starts tracking, creates floating gradient ghost element on 6px threshold, `onPointerUp` checks if over `[data-canvas-drop]` element via `getBoundingClientRect` and places widget at canvas-relative snapped coordinates. `onPointerCancel` handled. Listeners registered only during active drag (not at mount). `onWidgetDrop` prop on WidgetDock; `data-canvas-drop` attribute on canvas area in CanvasWorkspace. Agent icons are non-draggable. Tap/click still works via `onWidgetSelect` for quick placement.
    - **Interaction Sounds**: 5 dock sounds in `lib/soundManager.ts`: `dock_hover` (soft tick), `dock_drag_start` (rising blip), `dock_drop` (chord resolve), `dock_agent_start` (ascending 3-note chime), `dock_agent_end` (descending 2-note). All Web Audio synthesized, no external files. `playSound()` auto-creates AudioContext on first call (fallback); `initSoundManager()` also called explicitly on first hover for reliability. All dock sounds marked `essential: true` to play with default soundMode.
    - **Premium Widget Modal Redesign (Wave 17 — $20,000 quality)**:
        - `WidgetModal.tsx`: Size prop ('standard'=560px, 'wide'=680px, 'agent'=700px), 4-layer 3D shadow, frosted glass top-bevel, accent strip with outward glow, noteColor prop for StickyNote paper mode, spring entrance animation. noScroll prop for full-height widgets.
        - `lib/sounds.ts`: Added 6 new widget sounds: `playApproveSound`, `playDenySound`, `playMicActivateSound`, `playMessageSentSound`, `playTaskCompleteSound`, `playNoteSaveSound`.
        - `CanvasWorkspace.tsx`: Passes correct `size` prop per widget type (agent/wide/standard), `noScroll` for agent+messages+email, `noteColorOverride` state + `onNoteColorChange` callback wired to StickyNoteWidget.
        - `EmailWidget.tsx`: Flomail two-panel layout (240px left panel + flex right), Eli indicator strip, Office/Mail tabs, real data from Supabase + `/api/mail/threads`, thread rows with unread dots, detail panel, Open Inbox footer.
        - `InvoiceWidget.tsx`: Stripe-style hero gradient, 3 stat chips, filter tabs (All/Pending/Paid/Overdue), clean rows with hover lift, LinearGradient CTA.
        - `PhoneWidget.tsx`: AGL-style navy bg, Keypad/Recent/Contacts tabs, 60px dialpad circles, green call button with glow, active call overlay with controls.
        - `TextMessageWidget.tsx`: iMessage-style two-view (thread list → conversation), favorites horizontal scroll, gradient sent bubbles, compose bar with send button.
        - `QuoteWidget.tsx`: Status badge, client row, glass line-items table, totals block, full-width gradient Send CTA.
        - `ContractWidget.tsx`: Parties connected by line, signature status chips, deadline countdown progress bar (green→amber→red).
        - `CalendarWidget.tsx`: Inline calendar grid (day cells, today=green, event dots), view toggle (Day/Week/Month), selected day event panel, dark overrides.
        - `TodaysPlanWidget.tsx`: Two-view (list + detail), hero task count, priority badges (HIGH=blue/MEDIUM=amber/LOW=gray), subtasks, Mark Complete animated pill.
        - `AuthorityQueueWidget.tsx`: Two-view (queue + detail), circular progress ring, 3 stat chips, 4px left risk stripe per row, Approve/Deny with sounds + haptics.
        - `FinanceHubWidget.tsx`: Green gradient hero, balance + change badge, sparkline bar chart, 3-col stat grid (Receivable/Payable/Runway), recent transactions.
        - `ReceiptsWidget.tsx`: Search + horizontal category filter chips, category-colored circles, status dots, dashed upload CTA.
        - `StickyNoteWidget.tsx`: ONE note per modal, 8 premium colors (Indigo/Amber/Coral/Teal/Lavender/Sky/Emerald/Rose), physical paper look (sheen overlay, corner fold, paperclip decoration), 800ms debounced Supabase autosave, color picker dots.
        - `AgentWidget.tsx`: Two-view Voice + Chat. Voice: 186px floating orb with float+pulse animations, agent gradient colors (Ava=blue/purple, Eli=amber/green, Finn=cyan/indigo), mic/chat/reset controls. Chat: bubble conversation with gradient user bubbles matching agent colors, compose bar with animated send button.

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