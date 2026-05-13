/**
 * Tim Rail — Controls Tab Regression Lock
 *
 * These tests assert file-content invariants for the Controls tab and the
 * laptop/tablet chrome-hoist behavior. They do NOT exercise runtime
 * behavior — they guarantee specific anti-patterns can't sneak back into
 * the codebase.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) =>
  readFileSync(join(ROOT, rel.replace(/\//g, '\\')), 'utf8');

describe('Tim Rail — Controls Tab', () => {
  describe('TimRailTabSwitcher', () => {
    const src = read(
      'components/service-hub/estimate-studio/tim-rail/TimRailTabSwitcher.tsx',
    );

    it('declares Controls as the third tab id (replaces Activity)', () => {
      expect(src).toMatch(
        /TimRailTabId\s*=\s*'controls'\s*\|\s*'context'\s*\|\s*'assistant'/,
      );
    });

    it('renders the Controls label (not Activity)', () => {
      expect(src).toMatch(/label:\s*'Controls'/);
      expect(src).not.toMatch(/label:\s*'Activity'/);
    });
  });

  describe('TimRailContainer', () => {
    const src = read(
      'components/service-hub/estimate-studio/TimRailContainer.tsx',
    );

    it('imports TimRailControlsTab', () => {
      expect(src).toMatch(
        /import\s+\{\s*TimRailControlsTab\s*\}\s+from\s+'\.\/tim-rail\/TimRailControlsTab'/,
      );
    });

    it('renders TimRailControlsTab when activeTab === controls', () => {
      expect(src).toMatch(
        /activeTab\s*===\s*'controls'\s*&&\s*<TimRailControlsTab\s*\/>/,
      );
    });

    it('no longer renders ActivityPlaceholder', () => {
      expect(src).not.toMatch(/ActivityPlaceholder/);
    });
  });

  describe('TimRailControlsTab — section structure', () => {
    const src = read(
      'components/service-hub/estimate-studio/tim-rail/TimRailControlsTab.tsx',
    );

    it('renders three section titles: PROJECT, NAVIGATE, QUICK ACTIONS', () => {
      expect(src).toMatch(/title="PROJECT"/);
      expect(src).toMatch(/title="NAVIGATE"/);
      expect(src).toMatch(/title="QUICK ACTIONS"/);
    });

    it('lists all 6 studio tabs in the NAVIGATE grid', () => {
      const expectedTabs = [
        'Visuals',
        'Plans & Photos',
        'Scope',
        'Materials',
        'Takeoff',
        'Estimate',
      ];
      for (const label of expectedTabs) {
        expect(src).toContain(`label: '${label}'`);
      }
    });

    it('renders MaterialsSlotBar OR ProjectAddressBar based on pathname', () => {
      expect(src).toMatch(/isMaterialsTab\s*\?\s*<MaterialsSlotBar/);
      expect(src).toMatch(/:\s*<ProjectAddressBar/);
    });

    it('uses pathname.endsWith to detect Materials route (matches shell convention)', () => {
      expect(src).toMatch(/pathname\.endsWith\('\/materials'\)/);
    });

    it('uses shared useEstimateStudioActions hook for Upload + New Project', () => {
      expect(src).toMatch(
        /from\s+'@\/hooks\/useEstimateStudioActions'/,
      );
      expect(src).toMatch(/useEstimateStudioActions\(\)/);
    });

    it('hides PROJECT + NAVIGATE on desktop (>=1280) to avoid duplicating canvas chrome', () => {
      expect(src).toMatch(/DESKTOP_BREAKPOINT\s*=\s*1280/);
      expect(src).toMatch(/showChromeSections/);
    });

    it('has minimum 44pt tap target on primary buttons (a11y)', () => {
      expect(src).toMatch(/minHeight:\s*44/);
    });
  });

  describe('EstimateStudioShell — chrome hoist', () => {
    const src = read(
      'components/service-hub/estimate-studio/EstimateStudioShell.tsx',
    );

    it('declares LAPTOP_OR_TABLET_BREAKPOINT = 1280', () => {
      expect(src).toMatch(/LAPTOP_OR_TABLET_BREAKPOINT\s*=\s*1280/);
    });

    it('hides EstimateStudioHeader / slot / tab bar when isLaptopOrTablet', () => {
      // The header + slot + tab bar must live inside a `!isLaptopOrTablet`
      // conditional so the canvas is hero-only at laptop+tablet widths.
      expect(src).toMatch(/\!isLaptopOrTablet\s*&&/);
    });

    it('slims outer canvas maxWidth to 880 on laptop/tablet', () => {
      expect(src).toMatch(/isLaptopOrTablet[\s\S]{0,40}880/);
    });

    it('uses calc(100vh - 96px) on laptop/tablet (chrome-hoisted height)', () => {
      expect(src).toMatch(/calc\(100vh - 96px\)/);
    });
  });
});
