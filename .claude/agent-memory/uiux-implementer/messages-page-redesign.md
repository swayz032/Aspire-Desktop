---
name: Messages page redesign (Lane E2+E3)
description: Hero + filter tabs + thread list shell pattern for /session/messages — Pass 19 plan calm-lynx
type: project
---

## Files (Lane E2+E3)
- `app/session/messages.tsx` — full rewrite, page shell with try-import LaneE4Pane fallback
- `components/messages/MessagesHero.tsx` — peer of FrontDeskSetupHero/MemoryEngineHero
- `components/messages/MessagesFilterTabs.tsx` — spring-physics underline + ⌘1–⌘4
- `components/messages/MessagesThreadList.tsx` — virtualized list + context menu
- `components/messages/fixtures.ts` — MOCK_THREADS_5 + computeFilterCounts + filterThreadsByTab
- `components/messages/*.demo.tsx` — sibling demos (3 files)

## Hero pattern (peer of FrontDeskSetupHero)
- Square Aspire-blue gradient icon tile (44px, NOT circle) — reads as brand glyph
- TEXT MESSAGES pill with letter-spacing 1.4 + 6px glowing dot
- Title 32/700/-1 letter-spacing, white
- Subtitle 15/400 rgba(255,255,255,0.78), generative middot-separated
- Two buttons: Contacts (ghost) + New Message (primary cyan gradient)
- Both reuse `msg-hero-btn-*` CSS classes (mirrors `fds-hero-btn-*`)
- Animated icon-tile breathe (4.2s loop on web, opt-out via prefers-reduced-motion)
- 3 radial halos backdrop (web) / 1 linear gradient (native)

## Filter tabs pattern
- Animated.Value spring (damping 18, stiffness 180, mass 0.9) on translateX + width
- onLayout measurement per tab, ref-gated first-mount snap (no reset-on-mount jank)
- ⌘/Ctrl + 1-4 web keyboard, no hijack on input/textarea/contenteditable
- Overflow ⋮ menu uses click-outside dismiss with mousedown listener
- Count pills: rgba(255,255,255,0.06) inactive, rgba(59,130,246,0.20) active
- DO NOT use `Animated.Value.__getValue()` — TS-private. Use ref boolean instead.

## Thread list pattern
- 44px avatar with djb2 hash → HSL color (s=28%, l=22%; fg s=60%, l=75%)
- Online dot when last_activity < 60s
- Routing role pill: ALL CAPS letter-spacing 1.0, blue 16% bg + 30% border
- Hover (web): -2px translate + 1px blue ring + 24px blue glow
- Selected: 3px left bar (blue glow) + rgba(59,130,246,0.08) bg
- Ava-glow: faint right-edge cyan when last_drafter='ava'
- Context menu: web onContextMenu(e.preventDefault) + native onLongPress
- 4 differentiated empty states per filter (caught-up green check for unread)
- Web scrollbar: 6px, rgba(255,255,255,0.10), hover 0.18

## Page shell pattern (try-import LaneE4 fallback)
- Static `require()` wrapped in try/catch at module load
- `LaneE4Pane: ComponentType | null` resolved once
- When null, render local `RightPaneFallback` mirroring §3.9.4 4-state branching
- Selected thread + filter state lives at page level (passed down)
- Counts computed on universe (not filter slice) so they remain truthful
- console.info() noops for actions Lane E6 will wire

## Lint gotchas
- No `useMemo` import unless used → eslint warns
- No `ViewStyle` import unless used
- Curly quotes `“…”` in JSX text avoid react/no-unescaped-entities
- `as ViewStyle` cast is fine for inline web-only CSS strings
