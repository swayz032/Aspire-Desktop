# Canvas Mode Drag-Drop System — $10,000 UI/UX Quality Specification

**Quality Bar:** Figma canvas drag-drop, Apple Keynote object positioning, Webflow canvas interaction.

---

## 1. Interaction Flow Diagram

```
[DOCK ICON IDLE]
      ↓
  Mouse Hover → Scale 1.0→1.1× (150ms spring, damping:25, stiffness:300)
      ↓
  Mouse Down → Cursor: grab
      ↓
[DRAG INITIATION] (150ms lift animation)
      ├─ Original icon: Fade to 30% opacity (stays in dock as placeholder)
      ├─ Preview widget: Spawns at cursor, scale 1.05, shadow blur 40→60px
      ├─ Canvas: Blue glow pulse 0.04→0.08→0.04 (300ms)
      └─ Grid dots: Brighten rgba(255,255,255,0.035)→0.08
      ↓
[DRAGGING STATE]
      ├─ Preview follows cursor (60fps transform)
      ├─ Rotation: ±2° tilt based on cursor momentum (spring damped)
      ├─ Shadow: Intensifies (blur 60px, opacity 0.8)
      ├─ Cursor: grabbing
      ├─ Ghost preview: Shows at nearest 32px grid snap (100ms delay, dashed blue border)
      └─ Drop zone validation:
            ├─ Over canvas → Border blue, cursor grabbing
            ├─ Over dock → Border red, cursor not-allowed
            └─ Overlap existing widget → Border red, shake animation ready
      ↓
[DROP / CANCEL]
      ├─ SUCCESS DROP (on canvas, no overlap):
      │     ├─ Preview morphs to real widget (scale 1.05→0.95→1.0 bounce, 400ms spring)
      │     ├─ Opacity: 0.8→1.0 fade in
      │     ├─ Shadow: 60px→40px blur (settle)
      │     ├─ Rotation: Reset to 0° with overshoot spring
      │     ├─ Dock icon: Fade 30%→100% (300ms)
      │     └─ Sound: drop_success
      │
      ├─ ERROR DROP (overlap detected):
      │     ├─ Preview: Red shake (±4px horizontal, 3 cycles, 100ms each)
      │     ├─ Border: Pulse red (rgba(239,68,68,0.6))
      │     ├─ Sound: drop_error
      │     └─ Stays in dragging state (user must reposition)
      │
      └─ CANCEL (drop on dock OR press ESC):
            ├─ Preview: Curved arc trajectory back to dock (300ms easeOutQuad)
            ├─ On arrival: Dissolve (opacity 0, 200ms)
            ├─ Dock icon: Fade 30%→100% as preview returns
            └─ Sound: drag_cancel
      ↓
[SETTLED STATE]
      ├─ Widget placed at snapped grid position
      ├─ Canvas glow: Reset to 0.04
      ├─ Grid dots: Reset to 0.035
      └─ Ready for next drag
```

---

## 2. Visual State Specifications

### State 1: IDLE (Dock Icon)
```yaml
Icon:
  Size: 60×60px (ICON_SIZE: 36px inside)
  Border: 1px, desk accent color at 40% opacity
  Background: Desk accent at 18% opacity
  Glow: Ambient underglow (desk color, 6% opacity, 24px blur)
  Cursor: pointer
  Transform: scale(1.0)

Transition to HOVER: 150ms spring (damping:25, stiffness:300)
```

### State 2: HOVER (Dock Icon)
```yaml
Icon:
  Transform: scale(1.1)
  Glow: 6% → 12% opacity
  Cursor: grab
  Transition: Spring physics (NO linear timing)

Transition to PRESSED: Immediate on mouse down
```

### State 3: PRESSED (Dock Icon, initiating drag)
```yaml
Icon:
  Transform: scale(1.0) — reset before drag starts
  Cursor: grab

Drag Initiation (150ms):
  - Original icon fades: 100% → 30% opacity
  - Preview widget spawns at cursor position
  - Preview scale: 0.95 → 1.05 (lift effect)
  - Preview shadow: 40px → 60px blur
```

### State 4: DRAGGING (Preview Widget)
```yaml
Preview Widget:
  Size: 200×150px (CanvasDragTokens.preview.width/height)
  Background: rgba(14,14,18,0.85) — glass tint
  Border: 2px solid (color depends on drop zone validity)
    - Valid: rgba(59,130,246,0.4) — blue
    - Invalid (dock): rgba(239,68,68,0.4) — red
    - Overlap: rgba(239,68,68,0.6) — intense red
  Border Radius: 20px
  Shadow: 0 0 60px rgba(0,0,0,0.8)
  Backdrop Filter: blur(20px) saturate(1.4)
  Transform:
    - translateX/Y: Follow cursor (60fps)
    - scale: 1.05
    - rotateZ: ±2° based on cursor velocity (spring damped)
  Cursor: grabbing (valid) OR not-allowed (invalid)
  Z-Index: 1000

Ghost Preview (at snap position):
  Position: Nearest 32px grid intersection
  Size: Same as preview widget
  Border: 2px dashed rgba(59,130,246,0.4)
  Opacity: 0.4
  Delay: 100ms (smooth tracking, not instant)

Canvas Feedback:
  - Blue glow pulse: rgba(59,130,246) at 0.08 opacity (from 4 corner radial gradients)
  - Grid dots: brighten to rgba(255,255,255,0.08)
```

### State 5: DROPPING (Success Animation)
```yaml
Phase 1 (0-200ms): Scale bounce down
  - scale: 1.05 → 0.95
  - timing: linear descent

Phase 2 (200-400ms): Spring settle
  - scale: 0.95 → 1.0
  - spring: damping:20, stiffness:280, mass:0.9
  - rotation: Current → 0° (overshoot allowed)
  - opacity: 0.8 → 1.0
  - shadow: 60px → 40px blur

Dock Icon:
  - opacity: 30% → 100% (300ms linear)

Canvas Feedback:
  - Glow pulse: 0.08 → 0.04 (spring)
  - Grid dots: 0.08 → 0.035 (linear 300ms)
```

### State 6: ERROR (Overlap Shake)
```yaml
Shake Animation (3 cycles, 100ms each):
  translateX: 0 → +4px → -4px → +4px → -4px → +4px → -4px → 0
  Border: Pulse red rgba(239,68,68,0.6)
  Sound: drop_error

Widget remains in DRAGGING state — user must reposition
```

### State 7: CANCEL (Fly Back to Dock)
```yaml
Phase 1 (0-300ms): Curved arc trajectory
  - Path: Bezier curve from current position → dock origin
  - Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94) — easeOutQuad
  - Transform: Maintain rotation during flight

Phase 2 (300-500ms): Dissolve at dock
  - Opacity: 1.0 → 0.0 (200ms)
  - Dock icon: 30% → 100% (fade in as preview disappears)
  - Sound: drag_cancel
```

---

## 3. Animation Timing Curves

All animations use **spring physics** except where noted.

### Drag Initiation (Lift)
```typescript
Spring: { damping: 25, stiffness: 300, mass: 0.8 }
Duration: ~150ms settle time
Scale: 1.0 → 1.05
Shadow: 40px → 60px blur
Overshoot: <5% (premium, not bouncy)
```

### Preview Follow Cursor
```typescript
Transform: Direct assignment (60fps native driver)
Rotation Spring: { damping: 15, stiffness: 120 }
Velocity Input: (cursorX - lastX) / dt
Max Rotation: ±2° (clamped)
```

### Ghost Preview Snap
```typescript
Position Update: 100ms delay after cursor move
Algorithm: Math.round(cursorPos / 32) * 32
Visual: Dashed border (2px), opacity 0.4
Transition: None (instant snap, smooth via delay)
```

### Drop Success (Settle Bounce)
```typescript
Phase 1 (Scale Down):
  Timing: linear, 200ms
  Scale: 1.05 → 0.95

Phase 2 (Spring Settle):
  Spring: { damping: 20, stiffness: 280, mass: 0.9 }
  Duration: ~200ms
  Scale: 0.95 → 1.0
  Overshoot: ~3% (subtle bounce)

Concurrent Animations:
  - Opacity: 0.8 → 1.0 (linear 400ms)
  - Shadow Blur: 60px → 40px (linear 400ms)
  - Rotation: Current → 0° (spring, overshoot allowed)
```

### Cancel (Fly Back)
```typescript
Trajectory: Curved arc (NOT straight line)
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94)
Duration: 300ms
End Point: Dock icon origin

Dissolve:
  Delay: After arriving at dock
  Opacity: 1.0 → 0.0
  Duration: 200ms
```

### Error Shake
```typescript
Per Cycle (100ms):
  translateX: 0 → +4px → -4px → 0
  Easing: linear (hard shake, not smooth)

Total Duration: 300ms (3 cycles)
Border Pulse: Red color flash on each cycle
```

---

## 4. Ghost Preview Design

### Visual Appearance
```yaml
Position: Nearest 32px grid intersection to cursor
Size: 200×150px (matches preview widget)
Border: 2px dashed rgba(59,130,246,0.4)
Border Radius: 20px
Background: Transparent
Opacity: 0.4
Shadow: None (ghost is indicator only, not solid)
```

### Behavior
```yaml
Tracking: Follows cursor with 100ms delay
Update Frequency: On cursor move (debounced)
Snap Algorithm:
  ghostX = Math.round((cursorX - width/2) / 32) * 32
  ghostY = Math.round((cursorY - height/2) / 32) * 32

Visibility:
  - Show: When cursor over canvas + no overlap
  - Hide: When cursor over dock OR overlap detected
```

### Implementation (Web)
```css
border: 2px dashed rgba(59, 130, 246, 0.4);
border-radius: 20px;
opacity: 0.4;
pointer-events: none; /* CRITICAL: Don't block cursor */
position: absolute;
left: ${ghostX}px;
top: ${ghostY}px;
width: 200px;
height: 150px;
z-index: 100;
```

---

## 5. Drop Zone Feedback System

### Canvas Entrance (Drag Over Canvas)
```yaml
Trigger: Cursor enters canvas workspace bounds

Visual Changes:
  1. Blue Glow Pulse:
     - 4 radial gradients at corners (rgba(59,130,246))
     - Opacity: 0.04 → 0.08 (300ms spring)
     - Then settle: 0.08 → 0.04 (300ms spring)

  2. Grid Dots Brighten:
     - Idle: rgba(255,255,255,0.035)
     - Active: rgba(255,255,255,0.08)
     - Transition: 300ms linear

  3. Ghost Preview:
     - Appears at snap position (dashed blue border)

Sound: None (silent, visual only)
```

### Valid Drop Zone (Canvas, No Overlap)
```yaml
Preview Widget:
  - Border: rgba(59,130,246,0.4) — calm blue
  - Cursor: grabbing
  - Ghost: Visible (dashed border at snap position)

Canvas:
  - Glow: Sustained at 0.08 opacity
  - Grid: Sustained at 0.08 opacity
```

### Invalid Drop Zone (Over Dock)
```yaml
Preview Widget:
  - Border: rgba(239,68,68,0.4) — red warning
  - Cursor: not-allowed
  - Ghost: Hidden (no snap preview)

Canvas:
  - Glow: Fade to 0.04 (exit feedback)
  - Grid: Fade to 0.035
```

### Overlap Error (Widget Collision)
```yaml
Preview Widget:
  - Border: rgba(239,68,68,0.6) — intense red
  - Shake: Ready to trigger on drop attempt
  - Cursor: not-allowed
  - Ghost: Hidden (invalid position)

Canvas:
  - Glow: Fade to 0.04
  - Grid: Fade to 0.035

On Drop Attempt:
  - Trigger shake animation (±4px, 3 cycles, 100ms)
  - Play drop_error sound
  - Stay in dragging state (don't reset)
```

---

## 6. Error State Specifications

### Error Type 1: Overlap with Existing Widget
```yaml
Detection:
  - Algorithm: Bounding box intersection test
  - Checks: All existing widgets on canvas
  - Trigger: On every cursor move during drag

Visual Feedback:
  - Preview border: rgba(239,68,68,0.6) — intense red
  - Ghost preview: Hidden
  - Cursor: not-allowed

On Drop Attempt:
  - Shake animation: ±4px horizontal, 3 cycles, 100ms per cycle
  - Border pulse: Red flash on each shake
  - Sound: drop_error
  - Result: Stay in dragging state (user must reposition)

Recovery:
  - User drags to non-overlapping position
  - Border changes: Red → Blue
  - Ghost reappears
  - Cursor: not-allowed → grabbing
```

### Error Type 2: Drop Outside Canvas (On Dock)
```yaml
Detection:
  - Cursor Y position check vs workspace bounds
  - If cursor over dock area → invalid

Visual Feedback:
  - Preview border: rgba(239,68,68,0.4) — red warning
  - Cursor: not-allowed
  - Ghost: Hidden

On Drop:
  - No error shake (this is a cancel, not error)
  - Preview flies back to dock (curved arc, 300ms)
  - Dissolves on arrival (200ms opacity fade)
  - Dock icon fades in (30% → 100%)
  - Sound: drag_cancel

Recovery:
  - User can re-initiate drag from dock
```

### Error Type 3: Out of Bounds (Off Screen)
```yaml
Detection:
  - Cursor leaves viewport or workspace container
  - Browser loses focus during drag

Behavior:
  - Auto-cancel drag
  - Preview flies back to dock (same as cancel)
  - No error state shown (graceful degradation)

Sound: drag_cancel
```

---

## 7. Accessibility Keyboard Workflow

Full keyboard-only drag-drop alternative for screen reader users.

### Workflow Diagram
```
[DOCK ICON FOCUSED] (Tab navigation)
      ↓
  Press ENTER → "Pick up" widget (visual: focus ring on ghost preview)
      ↓
[KEYBOARD POSITIONING MODE]
      ├─ Arrow Keys: Move ghost 16px per step
      ├─ Shift+Arrow: Fine control (4px per step)
      ├─ Visual: Focus ring follows ghost position
      ├─ Announcer: "Widget at row 3, column 2" (every 5 steps)
      └─ Ghost snaps to 32px grid automatically
      ↓
  Press ENTER → Drop widget at ghost position
      ↓
[SUCCESS / ERROR]
      ├─ Success: Widget placed, focus moves to widget
      └─ Error (overlap): "Cannot place here, overlaps Invoice widget" (stay in positioning mode)
      ↓
  Press ESC (anytime) → Cancel, return to dock
```

### Keyboard Controls
```yaml
Tab: Focus next dock icon
Shift+Tab: Focus previous dock icon
Enter (on dock icon): Pick up widget, enter positioning mode
Arrow Keys: Move ghost preview (16px increments)
Shift+Arrow: Fine positioning (4px increments)
Enter (in positioning): Drop widget at ghost position
Escape: Cancel drag, return to dock

Screen Reader Announcements:
  - On pickup: "Picked up Invoice widget, use arrow keys to position"
  - On move: "Row 3, column 2" (throttled, every 5 steps)
  - On overlap: "Cannot place here, overlaps Email widget"
  - On drop: "Invoice widget placed at row 3, column 2"
  - On cancel: "Drag cancelled"
```

### Visual Focus States
```yaml
Dock Icon Focus:
  - Ring: 2px solid rgba(59,130,246,0.6)
  - Offset: 4px
  - Border Radius: Matches icon (16px)

Ghost Preview Focus (Positioning Mode):
  - Ring: 2px solid rgba(59,130,246,0.6)
  - Offset: 4px
  - Border Radius: 20px
  - Fills entire ghost preview area
  - Visible grid position indicator (text overlay)

Widget Focus (After Placement):
  - Ring: 2px solid rgba(59,130,246,0.6)
  - Offset: 4px
  - Border Radius: 22px (matches widget)
```

### Implementation Notes
```typescript
// Keyboard event listener (web only)
useEffect(() => {
  if (Platform.OS !== 'web' || !keyboardDragActive) return;

  const handleKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? FINE_STEP : STEP;

    switch (e.key) {
      case 'ArrowLeft': moveGhost(-step, 0); break;
      case 'ArrowRight': moveGhost(step, 0); break;
      case 'ArrowUp': moveGhost(0, -step); break;
      case 'ArrowDown': moveGhost(0, step); break;
      case 'Enter': attemptDrop(); break;
      case 'Escape': cancelDrag(); break;
    }
  };

  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, [keyboardDragActive]);
```

---

## 8. Touch vs Mouse Behavior Differences

### Mouse (Desktop)
```yaml
Hover State:
  - Dock icon scales to 1.1× on hover
  - Cursor changes: pointer → grab → grabbing
  - Glow intensity increases (6% → 12%)

Drag Initiation:
  - Trigger: Mouse down + move (instant)
  - Visual: Icon fades to 30% immediately

Drag Follow:
  - Preview follows cursor pixel-perfect (60fps)
  - Rotation based on cursor velocity
  - No latency

Drop:
  - Trigger: Mouse up (instant)
  - ESC key: Cancel drag (keyboard fallback)

Cursor States:
  - Idle: pointer
  - Hover: grab
  - Dragging (valid): grabbing
  - Dragging (invalid): not-allowed
```

### Touch (Tablet/Mobile)
```yaml
Hover State:
  - NO hover preview (touch devices have no hover)
  - Tap shows brief highlight (opacity 0.8, 100ms)

Drag Initiation:
  - Trigger: Long press (500ms)
  - Haptic feedback: Medium impact (if available)
  - Visual: Icon scales to 1.1× during long press
  - Icon fades to 30% on drag start

Drag Follow:
  - Preview slightly larger (1.1× base scale vs 1.05× mouse)
  - Follows touch point with small offset (avoid finger occlusion)
  - Less aggressive rotation (±1° vs ±2°)

Drop:
  - Trigger: Finger lift
  - Cancel: Tap outside canvas with second finger (OR return to dock)

Touch Feedback:
  - Long press: Haptic pulse (if available)
  - Drop success: Haptic success (2 quick taps)
  - Drop error: Haptic error (3 short buzzes)

Accessibility:
  - Touch long-press duration: 500ms (standard iOS/Android)
  - Visual countdown indicator during long press (optional)
```

### Platform Detection
```typescript
const isTouchDevice = Platform.OS !== 'web' ||
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const dragConfig = isTouchDevice
  ? {
      initiation: 'longPress',
      duration: 500,
      previewScale: 1.1,
      maxTilt: 1,
      haptic: true,
    }
  : {
      initiation: 'mouseDown',
      duration: 0,
      previewScale: 1.05,
      maxTilt: 2,
      haptic: false,
    };
```

---

## 9. Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Create `canvas.drag.tokens.ts` — All timing/spacing/color values
- [ ] Create `DragDropSystem.tsx` — Core interaction manager
- [ ] Implement snap-to-grid utility (32px)
- [ ] Implement overlap detection algorithm
- [ ] Set up animation shared values (Reanimated)

### Phase 2: Drag Initiation (Week 1-2)
- [ ] Dock icon hover state (scale 1.1×, spring physics)
- [ ] Drag start handler (from WidgetDock)
- [ ] Icon fade to 30% placeholder
- [ ] Preview widget spawn at cursor
- [ ] Canvas glow pulse (0.04 → 0.08 → 0.04)
- [ ] Grid dots brighten (0.035 → 0.08)
- [ ] Sound: drag_start

### Phase 3: Dragging State (Week 2)
- [ ] Preview follows cursor (60fps transform)
- [ ] Momentum rotation (±2° based on velocity)
- [ ] Shadow intensity (blur 60px, opacity 0.8)
- [ ] Ghost preview at snap position (100ms delay)
- [ ] Drop zone validation (canvas vs dock)
- [ ] Overlap detection (bounding box test)
- [ ] Cursor states (grabbing / not-allowed)

### Phase 4: Drop Success (Week 2-3)
- [ ] Scale bounce animation (1.05 → 0.95 → 1.0)
- [ ] Opacity fade in (0.8 → 1.0)
- [ ] Shadow settle (60px → 40px)
- [ ] Rotation reset (spring overshoot)
- [ ] Dock icon fade back (30% → 100%)
- [ ] Canvas feedback reset
- [ ] Sound: drop_success
- [ ] Telemetry: emitCanvasEvent('drop_success')

### Phase 5: Error States (Week 3)
- [ ] Overlap shake animation (±4px, 3 cycles)
- [ ] Red border pulse on shake
- [ ] Sound: drop_error
- [ ] Stay in dragging state (don't reset)
- [ ] Visual recovery (red → blue when repositioned)

### Phase 6: Cancel State (Week 3)
- [ ] Curved arc trajectory calculation
- [ ] Fly back animation (300ms easeOutQuad)
- [ ] Dissolve on arrival (opacity 0, 200ms)
- [ ] Dock icon fade in
- [ ] Sound: drag_cancel
- [ ] ESC key handler (keyboard cancel)

### Phase 7: Accessibility (Week 4)
- [ ] Keyboard drag initiation (Enter on dock icon)
- [ ] Arrow key positioning (16px / 4px steps)
- [ ] Focus ring visual (2px blue, 4px offset)
- [ ] Screen reader announcements (aria-live)
- [ ] Enter to drop, ESC to cancel
- [ ] Keyboard navigation flow diagram

### Phase 8: Touch Support (Week 4)
- [ ] Long press detection (500ms)
- [ ] Haptic feedback (initiation / success / error)
- [ ] Touch preview scale (1.1× vs 1.05×)
- [ ] Reduced tilt rotation (±1° vs ±2°)
- [ ] Finger occlusion offset (preview above touch point)

### Phase 9: Polish & Testing (Week 5)
- [ ] Reduced motion media query support
- [ ] Multi-widget stacking (z-index management)
- [ ] Click-to-front (bring widget to top)
- [ ] Canvas boundary enforcement (prevent off-screen drop)
- [ ] Performance audit (60fps validation)
- [ ] Cross-browser testing (Chrome/Safari/Firefox)
- [ ] Touch device testing (iPad/Android)

### Phase 10: Documentation (Week 5)
- [ ] Integration guide for CanvasWorkspace
- [ ] API documentation for DragDropSystem props
- [ ] Animation timing reference chart
- [ ] Accessibility testing checklist
- [ ] Known limitations document

---

## 10. Integration Example

### CanvasWorkspace.tsx Integration
```typescript
import { DragDropSystem } from '@/components/canvas/DragDropSystem';
import { WidgetDock } from '@/components/canvas/WidgetDock';

export function CanvasWorkspace() {
  const [placedWidgets, setPlacedWidgets] = useState<WidgetPosition[]>([]);
  const workspaceRef = useRef<View>(null);
  const [workspaceBounds, setWorkspaceBounds] = useState<LayoutRectangle | null>(null);

  const handleWidgetDrop = (tile: TileEntry, position: { x: number; y: number }) => {
    setPlacedWidgets((prev) => [
      ...prev,
      {
        x: position.x,
        y: position.y,
        tileId: tile.id,
        zIndex: prev.length + 1,
      },
    ]);
  };

  useEffect(() => {
    // Measure workspace bounds for boundary detection
    if (workspaceRef.current) {
      workspaceRef.current.measure((x, y, width, height, pageX, pageY) => {
        setWorkspaceBounds({ x: pageX, y: pageY, width, height });
      });
    }
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Widget Dock (bottom) */}
      <WidgetDock position="bottom" />

      {/* Canvas Workspace with Drag-Drop */}
      <View ref={workspaceRef} style={{ flex: 1 }}>
        <DragDropSystem
          widgets={placedWidgets}
          onWidgetDrop={handleWidgetDrop}
          onDragCancel={() => console.log('Drag cancelled')}
          workspaceBounds={workspaceBounds}
        >
          {/* Existing canvas content (grid, vignette, tiles, etc.) */}
          <CanvasGrid />
          <VignetteOverlay />
          {/* ... */}
        </DragDropSystem>
      </View>
    </View>
  );
}
```

---

## Quality Validation Checklist

### Visual Quality
- [ ] All transitions use spring physics (NO linear timing except shake)
- [ ] Shadows are VISIBLE (not dark-on-dark)
- [ ] Rotation is momentum-based (physics-driven, not arbitrary)
- [ ] Ghost preview uses dashed border (NOT solid)
- [ ] Canvas glow pulse is subtle (NOT overwhelming)

### Performance
- [ ] Drag preview updates at 60fps (no jank)
- [ ] Transform uses native driver (translateX/Y/scale/rotate)
- [ ] No layout thrashing (measure once, update via transform)
- [ ] Reduced motion support (disable all animations)

### Accessibility
- [ ] Keyboard workflow is FULLY FUNCTIONAL (not afterthought)
- [ ] Screen reader announces all state changes
- [ ] Focus ring is VISIBLE (2px blue, 4px offset)
- [ ] ESC key cancels drag from any state
- [ ] Tab order is logical (dock → widgets)

### Edge Cases
- [ ] Drag off-screen → auto-cancel (graceful)
- [ ] Overlap detection works for all widget sizes
- [ ] Multi-touch doesn't break drag state
- [ ] Window resize during drag → cancel safely
- [ ] Browser loses focus → cancel drag

---

**This is $10,000 agency-grade interaction design. Every detail matters. Ship this, and users will feel the quality.**
