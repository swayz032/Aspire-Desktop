# UI/UX Implementer Memory

## Project Structure
- **Token files**: `constants/tokens.ts` (main) + `constants/canvas.tokens.ts` (canvas-specific)
- **Canvas components**: `components/canvas/` — CanvasWorkspace, CanvasGrid, CanvasModeToggle, VignetteOverlay, Stage, LiveLens, etc.
- **Shared tokens namespace**: `Canvas` in tokens.ts, `CanvasTokens` in canvas.tokens.ts
- **Style convention**: `StyleSheet.create()` everywhere, web-only CSS via `as unknown as ViewStyle` cast

## Design Direction (Established 2026-03-01)
- **Canvas surface**: Authority Queue gray `#2A2A2A` — physical desk/workspace feel
- **Widget cards**: Today's Plan dark `#1E1E1E` — cards sit INTO the surface
- **Borders**: `rgba(255,255,255,0.08)` subtle, `rgba(59,130,246,0.3)` hover accent
- **Shadows**: Clean physical depth ONLY — `0 2px 8px rgba(0,0,0,0.3)` style
- **NO**: Deep black (#060608/#0A0A0A), excessive blue glow, glassmorphism backdrop-filter, sci-fi aesthetic
- **YES**: Two-tone gray, real shadows, companyPill toggle style, drafting surface grid

## CanvasModeToggle Pattern
- Matches Ava desk panel `companyPill` aesthetic
- Two separate pill segments (NOT sliding indicator)
- Active: `rgba(59,130,246,0.2)` bg + `rgba(59,130,246,0.5)` border + `0 0 16px rgba(59,130,246,0.3)` shadow
- Inactive: `#242426` bg, transparent border
- Online dot indicator on active segment (6px, blue, with subtle glow)

## Grid Tokens
- `dotGridOpacity`: 0.06 on gray surface (was 0.03 on black)
- Grid dots: `rgba(255,255,255,0.06)` — visible on #2A2A2A
- Grid z-index: 2 (above base 0 and edge vignette 1)

## Canvas Workspace Layers
1. Base: #2A2A2A solid (z:0)
2. Edge vignette: radial-gradient transparent->rgba(0,0,0,0.15) (z:1)
3. Dot grid (z:2)
4. VignetteOverlay (z:1, from immersion store)
5. Content (z:5)
6-11: LiveLens, ContextMenu, SnapGhost, DragPreview, Stage, CommandPalette

## Finance Hub Card Patterns
- **Card tokens**: `CARD_BG=#1C1C1E`, `CARD_BORDER=rgba(255,255,255,0.06)`, `CARD_BORDER_HOVER=rgba(255,255,255,0.10)` from `constants/cardPatterns.ts`
- **Card hover lift**: Pressable with `cardHovered` bg `#222224` + web `translateY(-2)` + `boxShadow: '0 8px 24px rgba(0,0,0,0.3)'` + `CARD_BORDER_HOVER`
- **Card pressed**: bg `#1a1a1c` + `opacity: 0.95`
- **Staggered entrance**: `fadeInUp` keyframe, 40ms delay per card index, `cubic-bezier(0.16, 1, 0.3, 1)` easing
- **Button tap targets**: ALL buttons `minHeight: 44` + `paddingVertical: 10` (a11y compliance)
- **Button hover**: Glass = `rgba(255,255,255,0.10)`, Cyan = `rgba(59,130,246,0.18)`
- **Button pressed**: Dimmer bg + `opacity: 0.9` (NOT brighter — subtraction feedback)
- **Shimmer loading**: `background-position` animation (-200% to 200%), 1.8s ease-in-out infinite, gradient `#161618 -> #222224 -> #161618`
- **Keyframe injection**: Idempotent `document.createElement('style')` with ID check, per-component blocks
- **Web transitions**: `transition: 'all 0.2s ease'` on buttons, `outlineOffset: 2` for focus-visible
- **stopPropagation**: Inner Pressables call `e.stopPropagation()` to prevent card-level handler firing
- **ContractCard is the reference pattern** for all Finance Hub cards — TemplateCard now matches

## Modal Patterns (TemplatePreviewModal)
- **Backdrop**: `rgba(0,0,0,0.75)` + `backdropFilter: blur(8px)` + click-to-close via Pressable
- **Modal entrance**: `scale(0.96) + opacity: 0` -> `scale(1) + opacity: 1`, 0.25s cubic-bezier
- **Crossfade**: iframe `opacity 0->1` + placeholder `opacity 1->0` both with `transition: 'opacity 0.3s ease'`
- **Close button**: 44x44 min (was 32x32 -- fixed), borderRadius 10
- **Escape key**: `document.addEventListener('keydown')` in useEffect, cleanup on unmount
- **Shimmer sweep**: `linear-gradient(90deg, transparent 25%, rgba(59,130,246,0.06) 50%, transparent 75%)` over loading overlay
- **Draft CTA**: `minHeight: 48`, solid `Colors.accent.cyan` bg, hover uses `Colors.accent.cyanDark`
- **Colors.text.primary** for white icon/text on CTA (NOT hardcoded `#fff`)
- **iframe sizing**: Use `flex: 1` only (NO minHeight vh units) -- vh minHeight can overflow on smaller viewports when combined with maxHeight container
- **Modal maxHeight**: `95vh` with 24px backdrop padding = ~2.5vh breathing room per side (borderline tight on 768px)

## TemplateCard Thumbnail Patterns
- **resizeMode**: `contain` (shows full template, dark bg visible around edges)
- **aspectRatio**: `816/940` (PandaDoc template natural dimensions, ~0.87)
- **maxHeight cap**: 220px prevents cards from becoming thumbnail-dominated in 3-col grid
- **Divider rule**: 1px `rgba(255,255,255,0.06)` between thumbnail and card body -- smooths light-to-dark transition
- **Placeholder height**: 120px with matching bottom border for grid alignment consistency
- **Grid context**: 3-col FlatList, `cardCell: flex 1 / maxWidth 33.33%`, `gridRow gap: 14`

## Accessibility Patterns
- All toggles: `accessibilityRole="radiogroup"` on container, `accessibilityRole="radio"` on segments
- `accessibilityState={{ checked: isActive }}` on toggle segments
- Grid/decorative elements: `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`
- Keyboard: Arrow keys cycle modes, web-only `onKeyDown` handler
- Reduced motion: singleton `matchMedia` listener, animations snap to target
