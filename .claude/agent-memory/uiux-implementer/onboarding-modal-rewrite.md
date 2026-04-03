---
name: Onboarding Modal Rewrite
description: Onboarding page rewritten from scrolling form to 4-step floating modal with step indicator, spring animations, and review step
type: project
---

Onboarding page (`app/(auth)/onboarding.tsx`) rewritten from long scrolling form to premium floating modal.

**Why:** User requested premium agency-grade stepped onboarding experience replacing the long scroll form.

**How to apply:**
- 4 steps: About You -> Business -> Addresses -> Review & Launch
- Modal: 760px wide, #111113 surface, LinearGradient border, backdrop blur overlay
- Step indicator: dots + connectors + labels, green checkmarks for completed, cyan glow for active
- Spring animations between steps (damping: 20, stiffness: 200, mass: 0.9) via reanimated
- Review step shows summary cards with Edit buttons that jump back to target step
- Consent checkboxes moved to Review step (step 4)
- Validation split: Step 1 (personal), Step 2 (business), Step 3 (addresses), Step 4 (consent)
- All business logic, draft persistence, Places API, handleComplete preserved untouched
- Enter key advances steps (web only)
- All interactive elements have accessibilityLabel, accessibilityRole, min 44px tap targets
