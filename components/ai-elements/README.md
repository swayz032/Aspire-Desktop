# AI Elements Components

Premium Canvas Mode UI components for Aspire Desktop.

## WebPreview

Live Markdown renderer showing agent research and activity in real-time.

### Features

- **Platform-Aware Rendering**
  - Web: `<iframe>` with configurable sandbox policies
  - Native: `<WebView>` from react-native-webview

- **Real-Time Activity Feed**
  - Streams agent activity events as they occur
  - Auto-scrolls to latest event
  - Premium $10K dark aesthetic matching Authority Queue card

- **Security Sandbox Policies**
  - **internal**: Full trust, scripts allowed (Aspire internal content)
  - **external_curated**: Vetted sources, scripts + forms allowed
  - **external_untrusted**: Read-only, no scripts (maximum security)

- **Markdown Rendering**
  - Uses `react-markdown` for rich text formatting
  - Supports **bold**, *italic*, `code`, and links
  - Agent color-coded icons (Ava purple, Finn green, Eli blue)

### Usage

```typescript
import { WebPreview, AgentActivityEvent } from '@/components/ai-elements';

function CanvasChatMode() {
  const [events, setEvents] = useState<AgentActivityEvent[]>([
    {
      type: 'thinking',
      message: 'Analyzing your request...',
      icon: 'bulb',
      timestamp: Date.now(),
      agent: 'ava',
    },
    {
      type: 'tool_call',
      message: 'Searching **Stripe API** for invoices',
      icon: 'hammer',
      timestamp: Date.now() + 1000,
      agent: 'finn',
    },
    {
      type: 'done',
      message: 'Found `12 invoices` ready for review',
      icon: 'checkmark',
      timestamp: Date.now() + 2000,
      agent: 'finn',
    },
  ]);

  return (
    <WebPreview
      activityEvents={events}
      trustLevel="internal"
      onUrlClick={(url) => {
        console.log('URL clicked:', url);
        // Route through orchestrator for validation
      }}
    />
  );
}
```

### Props

```typescript
interface WebPreviewProps {
  activityEvents: AgentActivityEvent[];
  trustLevel: 'internal' | 'external_curated' | 'external_untrusted';
  onUrlClick?: (url: string) => void;
}

interface AgentActivityEvent {
  type: 'thinking' | 'tool_call' | 'step' | 'done' | 'error';
  message: string;          // Markdown-formatted text
  icon: string;             // Icon identifier (unused, auto-mapped from type)
  timestamp: number;        // Unix timestamp in milliseconds
  agent?: 'ava' | 'finn' | 'eli';
}
```

### Event Types

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| `thinking` | 💡 Bulb | Agent-specific | Agent analyzing request |
| `tool_call` | 🔨 Hammer | Agent-specific | Calling external API/tool |
| `step` | ▶️ Chevron | Agent-specific | Progress update |
| `done` | ✅ Checkmark | Agent-specific | Task completed |
| `error` | ❌ Alert | Agent-specific | Error occurred |

### Agent Colors

- **Ava** (`#A855F7`): Purple glow
- **Finn** (`#10B981`): Green glow
- **Eli** (`#3B82F6`): Blue glow

### Security (Aspire Law #9)

Sandbox policies enforce security based on content trust level:

```typescript
// Internal Aspire content (full trust)
trustLevel="internal" → sandbox="allow-scripts"

// Vetted external sources (curated trust)
trustLevel="external_curated" → sandbox="allow-scripts allow-forms"

// Untrusted external content (maximum security)
trustLevel="external_untrusted" → sandbox="" (no scripts, read-only)
```

**URL Click Handling:**
- All URL clicks route through `onUrlClick` callback
- Orchestrator validates URLs before navigation
- Never executes URLs directly from untrusted content

### Platform Differences

**Web:**
- Renders events as React components in ScrollView
- Uses native Markdown rendering via react-markdown
- Smooth CSS animations for latest event glow

**Native (iOS/Android):**
- Renders events as HTML string in WebView
- HTML contains inline CSS for styling
- JavaScript disabled for `external_untrusted` content

### Design Tokens (CanvasTokens)

```typescript
background.surface    → #1E1E1E (main background)
background.elevated   → #2A2A2A (event cards)
border.subtle         → rgba(255,255,255,0.15) (card borders)
border.emphasis       → rgba(59,130,246,0.4) (latest event glow)
shadow.ambient        → rgba(59,130,246,0.1) (blue glow)
text.primary          → #FFFFFF (bold text)
text.secondary        → rgba(255,255,255,0.7) (body text)
text.muted            → rgba(255,255,255,0.5) (timestamps)
```

### Performance

- **Auto-scroll**: Smooth animated scroll to bottom on new events
- **Virtualization**: Not implemented (assumed short feed <100 events)
- **Re-renders**: Optimized with React.memo on EventCard (future)

### Testing Checklist

- [ ] Static Markdown renders correctly
- [ ] `trustLevel='internal'` allows scripts
- [ ] `trustLevel='external_untrusted'` blocks scripts
- [ ] Activity stream auto-scrolls to bottom
- [ ] URL clicks route through `onUrlClick`
- [ ] Agent colors match CanvasTokens
- [ ] Timestamps format correctly (2s ago, 1m ago)
- [ ] Latest event shows blue glow border

### Example Output

See `WebPreview.example.tsx` for interactive demo with:
- Simulated event stream (new event every 3s)
- Error event button
- Full agent color demonstration
