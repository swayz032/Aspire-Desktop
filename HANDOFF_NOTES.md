# Claude Code Handoff Notes — Aspire Mobile App

**Date:** January 11, 2026  
**Status:** Frontend MVP Complete (Mock Data)  
**Next Phase:** Backend Integration

---

## Executive Summary

The Aspire Founder Console mobile app frontend is complete with mock data. The app implements:

1. **Enterprise-grade dark theme** with centralized design tokens
2. **5-tab navigation** (Home, Inbox, Mic, Receipts, Staff)
3. **Session surfaces** (Voice, Video, Conference) accessible from Home
4. **Office Staff directory** with 8 AI worker profiles
5. **Authority Queue** for governance approvals
6. **Cash Position + Business Roadmap** operational cards

All screens use TypeScript interfaces that match the expected backend schema.

---

## Architecture Overview

### Data Flow
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│   Backend API    │────▶│    Database     │
│  (React Native) │     │  (Your Choice)   │     │   (Postgres)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │              ┌──────────────────┐
         └─────────────▶│    LiveKit       │
                        │  (Voice/Video)   │
                        └──────────────────┘
```

### Current State: MockApi

All data is served from `data/mockData.ts` via the `MockApi` class:

```typescript
import { MockApi } from '@/data/mockData';

// Current usage in components
const tenant = await MockApi.getTenant();
const queue = await MockApi.getAuthorityQueue();
const receipts = await MockApi.getReceipts();
const staff = await MockApi.getStaff();
const cash = await MockApi.getCashPosition();
const pipeline = await MockApi.getPipeline();
```

---

## TypeScript Interfaces (Backend Contract)

All interfaces are in `types/index.ts`. The backend must return data matching these shapes.

### Tenant
```typescript
interface Tenant {
  id: string;                          // "tnt_zenith_001"
  businessName: string;                // "Zenith Solutions"
  suiteId: string;                     // "ZEN-014" (isolation boundary)
  officeId: string;                    // "O-1029" (office instance)
  role: 'Founder' | 'Owner' | 'Admin' | 'Member';
  businessEmail?: string;
  businessPhone?: string;
  status: 'active' | 'suspended';
}
```

### AuthorityItem
```typescript
interface AuthorityItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'session' | 'invoice' | 'contract' | 'call' | 'email' | 'approval';
  status: 'live' | 'pending' | 'blocked' | 'failed' | 'logged';
  priority: 'high' | 'medium' | 'low';
  timestamp: string;                   // ISO 8601
  dueDate?: string;
  thumbnailUrl?: string;
  documentType?: 'pdf' | 'image' | 'video';
  actions: ('review' | 'approve' | 'deny' | 'defer' | 'delegate' | 'join')[];
  staffRole?: string;                  // Which AI staff member owns this
  receiptId?: string;                  // Link to receipt if logged
}
```

### Receipt (Immutable)
```typescript
interface Receipt {
  id: string;
  type: 'allow' | 'deny' | 'fail' | 'success';
  capability: string;                  // e.g., "EMAIL_SEND", "CONTRACT_BIND"
  title: string;
  subtitle: string;
  timestamp: string;
  staffRole: string;                   // Which AI staff executed
  actor: string;                       // user_id, system, or Ava
  intent?: string;                     // What was requested
  plan?: string[];                     // Steps taken
  evidence?: {
    type: 'email' | 'call' | 'document' | 'transaction';
    summary: string;
  };
  tags: string[];
}
```

### StaffRole
```typescript
interface StaffRole {
  id: string;
  name: string;                        // "Quinn", "Eli", etc.
  role: string;                        // "Billing Specialist"
  internalPackId: string;              // "invoice_desk"
  outcome: string;                     // Value proposition
  whatIDo: string[];                   // Capabilities
  needsApprovalFor: string[];          // Gated actions
  neverDo: string[];                   // Hard limits
  receipts: string;                    // What receipts it generates
  status: 'active' | 'available' | 'coming_soon';
  approvalLevel: 'always' | 'conditional' | 'auto_low_risk';
  badges: {
    approval: boolean;
    receipts: boolean;
    limits: boolean;
    certified?: boolean;
  };
  avatarColor: string;                 // Hex color for avatar
}
```

### Session
```typescript
interface Session {
  id: string;
  type: 'voice' | 'video' | 'conference';
  state: SessionState;
  startedAt?: string;
  transcript?: TranscriptEntry[];
  currentContext: DocumentPreview[];
  authorityQueue: AuthorityItem[];
  riskLevel: 'low' | 'medium' | 'high';
  mode: 'listening_only' | 'execution_enabled';
}

type SessionState = 
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'responding'
  | 'awaiting_approval'
  | 'executing'
  | 'ended';
```

### Financial
```typescript
interface CashPosition {
  availableCash: number;
  upcomingOutflows7d: number;
  expectedInflows7d: number;
  accountsConnected: number;
}

interface PipelineStage {
  name: string;
  count: number;
  target: number;
  trend: 'up' | 'down' | 'flat';
}
```

---

## API Endpoints Required

### RESTful Endpoints

```
# Tenant
GET    /api/tenant              → Tenant

# Authority Queue
GET    /api/authority-queue     → AuthorityItem[]
POST   /api/authority-queue/:id/action
       Body: { action: 'approve' | 'deny' | 'defer' | 'delegate' }
       → Receipt

# Receipts (Immutable)
GET    /api/receipts            → Receipt[]
GET    /api/receipts/:id        → Receipt

# Staff
GET    /api/staff               → StaffRole[]
GET    /api/staff/:id           → StaffRole
PATCH  /api/staff/:id           → StaffRole  (status changes only)

# Sessions
POST   /api/sessions            → Session
       Body: { type: 'voice' | 'video' | 'conference' }
GET    /api/sessions/:id        → Session
PATCH  /api/sessions/:id        → Session
DELETE /api/sessions/:id        → Receipt  (end session)

# Financial
GET    /api/cash-position       → CashPosition
GET    /api/pipeline            → PipelineStage[]

# Inbox
GET    /api/inbox               → InboxItem[]
PATCH  /api/inbox/:id/read      → InboxItem
```

### WebSocket Events (for real-time)

```typescript
// Session state changes
interface SessionEvent {
  type: 'session:state_changed';
  sessionId: string;
  state: SessionState;
}

// New authority item
interface AuthorityEvent {
  type: 'authority:new_item';
  item: AuthorityItem;
}

// Receipt created
interface ReceiptEvent {
  type: 'receipt:created';
  receipt: Receipt;
}

// Transcript update
interface TranscriptEvent {
  type: 'session:transcript';
  sessionId: string;
  entry: TranscriptEntry;
}
```

---

## Integration Steps

### Step 1: Create API Client

Replace `MockApi` with a real API client:

```typescript
// lib/api.ts
const API_BASE = process.env.API_BASE_URL;

export const api = {
  async getTenant(): Promise<Tenant> {
    const res = await fetch(`${API_BASE}/api/tenant`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },
  
  async getAuthorityQueue(): Promise<AuthorityItem[]> {
    const res = await fetch(`${API_BASE}/api/authority-queue`);
    return res.json();
  },
  
  // ... etc
};
```

### Step 2: Add State Management

Consider React Context or Zustand for:
- `TenantProvider` - Current tenant context
- `SessionProvider` - Active session state
- `AuthorityProvider` - Authority queue with real-time updates

### Step 3: LiveKit Integration

For voice/video sessions:

```typescript
// In session screens
import { Room, RoomEvent } from 'livekit-client';

const room = new Room();
await room.connect(LIVEKIT_URL, token);

room.on(RoomEvent.DataReceived, (data) => {
  // Handle transcript updates
});
```

### Step 4: Receipt Generation

Every action must generate a receipt. The backend should:

1. Validate the action against policy
2. Execute (or deny) the action
3. Create an immutable receipt record
4. Return the receipt to the client

---

## Security Considerations

### Tenant Isolation
- All queries must filter by `tenantId`
- Use Row-Level Security (RLS) in Postgres
- Never expose cross-tenant data

### Capability Tokens
- Short-lived (10 minutes max)
- Single-use for high-risk actions
- Minted only by orchestrator

### Step-Up Auth
Required for:
- Money movement
- Contract signing
- External sends
- Staff permission changes

---

## Testing Checklist

Before deploying:

- [ ] Tenant isolation verified (no cross-tenant leaks)
- [ ] All actions generate receipts
- [ ] Authority queue updates in real-time
- [ ] Session state machine handles all transitions
- [ ] Voice/video connects to LiveKit
- [ ] Step-up auth works for high-risk actions
- [ ] Offline mode gracefully degrades
- [ ] Error states show user-friendly messages

---

## Files to Modify for Integration

| File | Change |
|------|--------|
| `data/mockData.ts` | Replace with real API calls |
| `app/_layout.tsx` | Add providers (Tenant, Session, Auth) |
| `app/session/*.tsx` | Connect to LiveKit |
| `.env` | Add API_BASE_URL, LIVEKIT_URL |
| `package.json` | Add `livekit-react-native` |

---

## Contact

Questions about the frontend architecture? The mock data in `data/mockData.ts` contains comprehensive examples of all data shapes. The design tokens in `constants/tokens.ts` document the complete visual system.
