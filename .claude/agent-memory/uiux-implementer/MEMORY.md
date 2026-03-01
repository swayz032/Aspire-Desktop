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

## Accessibility Patterns
- All toggles: `accessibilityRole="radiogroup"` on container, `accessibilityRole="radio"` on segments
- `accessibilityState={{ checked: isActive }}` on toggle segments
- Grid/decorative elements: `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`
- Keyboard: Arrow keys cycle modes, web-only `onKeyDown` handler
- Reduced motion: singleton `matchMedia` listener, animations snap to target
