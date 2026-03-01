# WebPreview Component

Live Markdown renderer for Canvas Chat Mode agent activity streams.

## Overview

WebPreview displays real-time agent research and activity in a premium, $10K aesthetic interface. It renders agent events with:
- Platform-aware rendering (iframe on web, WebView on native)
- Sandbox security policies based on trust level
- Markdown formatting with syntax highlighting
- Agent-specific color accents
- Auto-scroll to latest events
- Premium spacing and animations

## Usage

```typescript
import { WebPreview, AgentActivityEvent } from '@/components/ai-elements/WebPreview';

function ChatInterface() {
  const [events, setEvents] = useState<AgentActivityEvent[]>([]);

  return (
    <WebPreview
      activityEvents={events}
      trustLevel="internal"
      onUrlClick={(url) => {
        // Validate URL through orchestrator before opening
        console.log('URL clicked:', url);
      }}
    />
  );
}
```

## Props

### `activityEvents: AgentActivityEvent[]`
Array of events to display. Each event has:
- `type`: 'thinking' | 'tool_call' | 'step' | 'done' | 'error'
- `message`: Markdown-formatted message text
- `icon`: Icon identifier (used in native WebView)
- `timestamp`: Unix timestamp (ms)
- `agent?`: 'ava' | 'finn' | 'eli' (optional)

### `trustLevel: TrustLevel`
Security sandbox policy:
- `'internal'`: Full trust (allow-scripts) — Aspire internal content
- `'external_curated'`: Limited trust (allow-scripts allow-forms) — vetted sources
- `'external_untrusted'`: Zero trust (no scripts) — read-only display

### `onUrlClick?: (url: string) => void`
Callback when user clicks a link in markdown content. **IMPORTANT:** URLs must be validated through the orchestrator before opening (Aspire Law #9 - Security & Privacy).

## Event Types

### Thinking
Agent is analyzing or planning.
```typescript
{
  type: 'thinking',
  message: 'Analyzing your invoice request...',
  icon: 'bulb',
  timestamp: Date.now(),
  agent: 'ava',
}
```

### Tool Call
Agent is invoking an external API or tool.
```typescript
{
  type: 'tool_call',
  message: 'Calling `stripe.invoices.create()`',
  icon: 'hammer',
  timestamp: Date.now(),
  agent: 'finn',
}
```

### Step
Agent completed a discrete step in the workflow.
```typescript
{
  type: 'step',
  message: 'Found customer: **Acme Corp** (ID: `cus_123`)',
  icon: 'chevron',
  timestamp: Date.now(),
  agent: 'finn',
}
```

### Done
Agent completed the entire task successfully.
```typescript
{
  type: 'done',
  message: 'Invoice draft created. Ready for review.',
  icon: 'checkmark',
  timestamp: Date.now(),
  agent: 'ava',
}
```

### Error
Agent encountered an error or failure.
```typescript
{
  type: 'error',
  message: 'Failed to connect to **Stripe API**. Check credentials.',
  icon: 'alert',
  timestamp: Date.now(),
  agent: 'finn',
}
```

## Markdown Support

The component supports standard Markdown syntax:

- **Bold**: `**text**` → renders with primary color and 600 weight
- *Italic*: `*text*` → renders with italic style
- `Code`: `` `code` `` → renders with monospace font and subtle background
- Links: `[text](url)` → renders with blue accent, routes through `onUrlClick`

## Agent Colors

Each agent has a signature color accent:
- **Ava**: Purple (`#A855F7`) — conversational intelligence
- **Finn**: Green (`#10B981`) — finance operations
- **Eli**: Blue (`#3B82F6`) — communications

## Platform Behavior

### Web
Uses React Native ScrollView with styled event cards. Renders markdown using `react-markdown` with custom component renderers.

### Native (iOS/Android)
Uses WebView with pre-rendered HTML. JavaScript enabled/disabled based on trust level.

## Security (Aspire Law #9)

### Sandbox Policies
- **Internal**: Scripts allowed (full trust for Aspire internal content)
- **External Curated**: Scripts + forms allowed (vetted third-party sources)
- **External Untrusted**: No scripts (read-only, user-submitted content)

### URL Validation
All link clicks route through `onUrlClick` callback. The orchestrator MUST validate URLs before opening:
```typescript
onUrlClick={(url) => {
  // BAD: Direct navigation
  // window.open(url);

  // GOOD: Orchestrator validation
  validateUrlThroughOrchestrator(url).then((safe) => {
    if (safe) window.open(url);
  });
}}
```

### PII Protection
Never log event messages directly to console/analytics. Messages may contain:
- Customer names
- Email addresses
- Phone numbers
- Financial data

Use Presidio DLP for redaction before logging (see backend orchestrator).

## Performance

### Auto-Scroll
Component automatically scrolls to bottom when new events are added. Uses `useEffect` with `events.length` dependency.

### Rendering
- Web: Native React components (fast)
- Native: WebView HTML (single render per update)

### Large Event Streams
For streams >100 events, consider:
- Pagination (show last 50 events)
- Virtual scrolling (react-window)
- Event grouping (collapse old events)

## Styling

Uses CanvasTokens design system:
- Background: `CanvasTokens.background.surface` (#1E1E1E)
- Cards: `CanvasTokens.background.elevated` (#2A2A2A)
- Borders: `CanvasTokens.border.subtle` + blue glow on latest
- Text: `CanvasTokens.text.primary/secondary/muted`
- Shadows: Blue ambient glow (`CanvasTokens.shadow.ambient`)

## Testing

Run tests:
```bash
npm test -- components/ai-elements/__tests__/WebPreview.test.tsx
```

Coverage:
- ✅ Platform detection
- ✅ All event types
- ✅ Markdown rendering
- ✅ Agent colors
- ✅ Security sandbox policies
- ✅ Timestamp formatting
- ✅ Auto-scroll behavior
- ✅ Edge cases (long messages, no agent, duplicate timestamps)

## Demo

Interactive demo available in `WebPreview.demo.tsx`:
```bash
npm run dev
# Navigate to demo page
```

Features:
- Stream simulation (800ms delay between events)
- Error injection
- Trust level cycling
- Event counter

## Examples

### Basic Usage
```typescript
const events: AgentActivityEvent[] = [
  {
    type: 'thinking',
    message: 'Processing request...',
    icon: 'bulb',
    timestamp: Date.now(),
    agent: 'ava',
  },
];

<WebPreview activityEvents={events} trustLevel="internal" />
```

### With URL Validation
```typescript
<WebPreview
  activityEvents={events}
  trustLevel="external_curated"
  onUrlClick={(url) => {
    // Aspire Law #9: Validate before opening
    validateUrl(url).then(safe => {
      if (safe) openBrowser(url);
    });
  }}
/>
```

### Streaming Updates
```typescript
function StreamingChat() {
  const [events, setEvents] = useState<AgentActivityEvent[]>([]);

  useEffect(() => {
    const stream = subscribeToAgentActivity();
    stream.on('event', (newEvent) => {
      setEvents(prev => [...prev, newEvent]);
    });
    return () => stream.close();
  }, []);

  return <WebPreview activityEvents={events} trustLevel="internal" />;
}
```

## Integration with Canvas Chat Mode

WebPreview is designed for Canvas Chat Mode (3-panel layout):
- **Left Panel**: Conversation history
- **Center Panel**: WebPreview (agent activity)
- **Right Panel**: Draft/Receipt preview

Canvas context:
- Dark theme (`CanvasTokens.background.base` #0A0A0A)
- Blue accent lighting (`CanvasTokens.border.emphasis`)
- Premium spacing (16px padding, 12px gaps)

## Related Components

- **Stage.tsx**: Canvas worksurface container
- **Runway**: State machine for draft/approval flow
- **ImmersionStore**: Canvas mode state management

## Compliance

### Aspire Laws
- **Law #1 (Single Brain)**: Events come from orchestrator only, never autonomous
- **Law #2 (Receipts)**: Tool calls shown here must generate receipts
- **Law #4 (Risk Tiers)**: Event types map to governance tiers (thinking=GREEN, tool_call=YELLOW/RED)
- **Law #7 (Tools Are Hands)**: Agent activity is orchestrated, not autonomous
- **Law #9 (Security)**: Sandbox policies + URL validation + no PII logging

### Accessibility
- All interactive elements have semantic roles
- Color is not the only means of conveying information (icons + text)
- Timestamps provide temporal context
- Markdown content is screen-reader accessible

## Changelog

### v1.0.0 (2026-02-28)
- Initial implementation
- Platform-aware rendering (web ScrollView, native WebView)
- Sandbox security policies
- Markdown support with custom renderers
- Agent color mapping
- Auto-scroll to latest events
- Comprehensive test suite
- Interactive demo
