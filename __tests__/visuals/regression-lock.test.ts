/**
 * Visuals Tab — Regression Lock
 *
 * These tests assert file-content invariants for the design decisions
 * documented in `docs/locks/VISUALS_TAB_LOCK.md`. They DO NOT exercise
 * runtime behavior — they just guarantee specific anti-patterns can't
 * sneak back into the codebase.
 *
 * If a test here fails, the failure message tells you exactly which
 * lock was violated AND points you at the lock doc explaining why.
 * If the design intent has legitimately changed, update the lock doc
 * AND adjust the assertion in the SAME PR — never delete-only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Visuals Tab — Design Lock v1.0', () => {
  describe('Lock #1: House Inspector — single right-side cluster', () => {
    const src = read(
      'components/service-hub/estimate-studio/visuals/HouseInspectorControls.tsx',
    );

    it('does NOT render a left-side preset cluster', () => {
      // The cluster style would be `position: 'absolute', left: 14`.
      // Doc comments are allowed; rendered JSX is not.
      expect(src).not.toMatch(/styles\.presetCluster/);
      expect(src).not.toMatch(/<Text style=\{styles\.clusterLabel\}>VIEW FROM<\/Text>/);
    });

    it('keeps onPreset in the API surface (API-only, not in UI)', () => {
      // Prop must still exist so parents can drive the initial camera.
      expect(src).toMatch(/onPreset:\s*\(preset:\s*CameraPresetKey\)\s*=>\s*void/);
    });
  });

  describe('Lock #2: Street View Pano initial zoom = 2', () => {
    const src = read(
      'components/service-hub/estimate-studio/visuals/LiveStreetViewHero.tsx',
    );

    it('sets zoom: 2 (NOT zoom: 1)', () => {
      // Find the StreetViewPanorama constructor call. Its options object
      // starts right after the opening `(` and we read up to the matching
      // close-paren-semicolon. Use a non-greedy match anchored on `zoom:`
      // so we don't accidentally swallow nested object literals.
      // Skip the doc-comment occurrence; anchor on the real constructor
      // by requiring containerRef in the same call.
      const idx = src.indexOf('new google.maps.StreetViewPanorama(containerRef');
      expect(idx).toBeGreaterThanOrEqual(0);
      // 600-char window is enough for the options block.
      const window = src.slice(idx, idx + 800);
      // Match zoom: N followed by a non-digit (comma / end of options line).
      // Avoids false positives from `zoom: 18` on the inset satellite map.
      expect(window).toMatch(/zoom:\s*2(?!\d)/);
      expect(window).not.toMatch(/zoom:\s*1(?!\d)/);
    });
  });

  describe('Lock #3: Roof canvas — interactive Pano fallback (no Static API)', () => {
    const src = read('components/service-hub/estimate-studio/visuals/HeroSwitcher.tsx');

    it("branches roof mode on data.roofImagery === 'streetview'", () => {
      expect(src).toMatch(/data\?\.roofImagery\s*===\s*['"]streetview['"]/);
    });

    it('renders LiveStreetViewHero (interactive Pano) for the streetview branch', () => {
      // Both the streetview card AND the roof-fallback should use LiveStreetViewHero.
      const liveHeroUses = (src.match(/<LiveStreetViewHero/g) ?? []).length;
      expect(liveHeroUses).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Lock #4: Solar dataLayers walks HIGH → MEDIUM → LOW', () => {
    const src = read('server/serviceHub/property/googleSolarClient.ts');

    it('declares all three tiers in order', () => {
      // Tier declaration block.
      expect(src).toMatch(/quality:\s*['"]HIGH['"]/);
      expect(src).toMatch(/quality:\s*['"]MEDIUM['"]/);
      expect(src).toMatch(/quality:\s*['"]LOW['"]/);
    });

    it('supports qualityTiers opt-in for fast preflights', () => {
      expect(src).toMatch(/qualityTiers\?:\s*Array<['"]HIGH['"]\s*\|\s*['"]MEDIUM['"]\s*\|\s*['"]LOW['"]>/);
    });
  });

  describe('Lock #5: Solar coord validation = numeric range only', () => {
    const src = read('server/serviceHub/property/googleSolarClient.ts');

    it('does NOT regex the .toString() of the coord float', () => {
      // The old LATLNG_RE captured at most 8 decimals — JS doubles emit up to 17.
      expect(src).not.toMatch(/LATLNG_RE\.test/);
    });

    it('uses Number.isFinite + range check', () => {
      expect(src).toMatch(/Number\.isFinite\(coords\.lat\)/);
      expect(src).toMatch(/Number\.isFinite\(coords\.lng\)/);
    });
  });

  describe('Lock #6: Photo classifier — caption-driven, default interior', () => {
    const src = read('server/serviceHub/property/adamResearchClient.ts');

    it('does NOT contain the legacy positional heuristic', () => {
      expect(src).not.toMatch(/classifyByPosition/);
    });

    it('keeps a single classify() call that takes (caption, idx)', () => {
      expect(src).toMatch(/classify\(\s*caption[^,)]*,\s*idx\s*\)/);
    });
  });

  describe('Lock #8: Cache-write guard requires status=ok|partial + populated facts', () => {
    const src = read('server/serviceHub/property/propertyAggregator.ts');

    it('only writes when Adam status is ok or partial', () => {
      expect(src).toMatch(/adamResult\?\.status\s*===\s*['"]ok['"]/);
      expect(src).toMatch(/adamResult\?\.status\s*===\s*['"]partial['"]/);
    });

    it('also gates on facts.sqft and facts.yearBuilt being populated', () => {
      expect(src).toMatch(/facts\.sqft\s*!=\s*null/);
      expect(src).toMatch(/facts\.yearBuilt\s*!=\s*null/);
    });

    it('skipping cache write is logged with the suite_id and address', () => {
      expect(src).toMatch(/skipping cache write/);
    });
  });

  describe('Lock #9: Adam timeout = 60s', () => {
    const src = read('server/serviceHub/property/propertyAggregator.ts');

    it('ADAM_TIMEOUT_MS is at least 60s', () => {
      const m = src.match(/ADAM_TIMEOUT_MS\s*=\s*([\d_]+)/);
      expect(m).toBeTruthy();
      const ms = parseInt(m![1].replace(/_/g, ''), 10);
      expect(ms).toBeGreaterThanOrEqual(60_000);
    });
  });

  describe('Lock #11: PropertyData.facts surface stays comprehensive', () => {
    const src = read('services/serviceHub/propertyDataApi.ts');

    // Every locked field that the Context tab depends on.
    const required = [
      'roofCover',
      'permits',
      'mortgageLender',
      'ltvRatio',
      'availableEquity',
      'avmConfidenceScore',
      'avmFsd',
      'avmDate',
      'estimatedRent',
      'taxAssessedTotal',
      'previousOwnerName',
      'absenteeOwner',
      'homeownerExemption',
      'lastSaleCashOrMortgage',
      'appreciationPct',
    ];

    it.each(required)('declares facts.%s', (field) => {
      // The type may or may not have a ? — we just check the name exists
      // somewhere in the facts block.
      const factsBlock = src.match(/facts:\s*\{[\s\S]*?\n\s{2}\};/);
      expect(factsBlock).toBeTruthy();
      expect(factsBlock![0]).toMatch(new RegExp(`\\b${field}\\?:`));
    });
  });

  describe('Lock #12: Premium Context-tab design tokens present', () => {
    const src = read(
      'components/service-hub/estimate-studio/tim-rail/PropertySummaryCard.tsx',
    );

    it('declares statCard, chip, and permitCard primitives', () => {
      expect(src).toMatch(/statCard:\s*\{/);
      expect(src).toMatch(/chipPositive:\s*\{/);
      expect(src).toMatch(/permitCard:\s*\{/);
    });

    it('uses tabular-nums for numeric values', () => {
      expect(src).toMatch(/fontVariant:\s*\[\s*['"]tabular-nums['"]\s*\]/);
    });
  });

  describe('Lock #13: Street View shell flexes to fill heroSlot (4K crispness)', () => {
    const src = read(
      'components/service-hub/estimate-studio/visuals/LiveStreetViewHero.tsx',
    );

    // The shell style block — find from `shell: {` to its matching `},`.
    const shellMatch = src.match(/shell:\s*\{[\s\S]*?\n\s{2}\}/);

    it('shell style block exists', () => {
      expect(shellMatch).toBeTruthy();
    });

    it('shell sets flex: 1 (without it the pano renders at a fixed size '
       + 'and Google serves lower-res tiles = blurry Street View)', () => {
      expect(shellMatch![0]).toMatch(/\bflex:\s*1\b/);
    });

    it('shell does NOT cap with aspectRatio (legacy 12/5 was the blur cause)', () => {
      // The whole point of the regression: any aspectRatio reintroduces
      // the fixed-letterbox sizing that triggers low-res Pano tiles.
      expect(shellMatch![0]).not.toMatch(/\baspectRatio\s*:/);
    });

    it('shell keeps a minHeight floor (>= 320) so the pano never collapses', () => {
      const minHeightMatch = shellMatch![0].match(/minHeight:\s*(\d+)/);
      expect(minHeightMatch).toBeTruthy();
      expect(Number(minHeightMatch![1])).toBeGreaterThanOrEqual(320);
    });
  });

  describe('Lock #14: PhotoGalleryHero shell flexes + black bg (immersive)', () => {
    const src = read(
      'components/service-hub/estimate-studio/visuals/PhotoGalleryHero.tsx',
    );
    const shellMatch = src.match(/shell:\s*\{[\s\S]*?\n\s{2}\}/);

    it('shell uses flex:1 and #000000 bg', () => {
      expect(shellMatch).toBeTruthy();
      expect(shellMatch![0]).toMatch(/\bflex:\s*1\b/);
      expect(shellMatch![0]).toMatch(/backgroundColor:\s*['"]#000000['"]/);
    });

    it('shell does NOT pin a fixed aspectRatio (would clip images)', () => {
      expect(shellMatch![0]).not.toMatch(/\baspectRatio\s*:/);
    });
  });

  describe('Lock #15: ProjectAddressBar owns address input ONLY (Wave 0 cleanup)', () => {
    // Wave 0 (2026-05-17): Upload, "+ New Project", and the "Recent ▾"
    // dropdown were removed from the Estimate Studio header bar. Tim
    // Rail Controls > Quick Actions is the single source of truth for
    // Upload + New Project. This lock prevents them from being
    // re-introduced into ProjectAddressBar.
    const src = read(
      'components/service-hub/estimate-studio/ProjectAddressBar.tsx',
    );

    it('does NOT render an Upload button', () => {
      // Strip block comments so the rule comment in the file header
      // doesn't trigger a false positive.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/<Text[^>]*>Upload<\/Text>/);
      expect(code).not.toMatch(/testID=["']estimate-studio-upload-evidence["']/);
      expect(code).not.toMatch(/styles\.uploadButton\b/);
    });

    it('does NOT render a "New Project" button', () => {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/<Text[^>]*>New Project<\/Text>/);
      expect(code).not.toMatch(/testID=["']estimate-studio-new-project["']/);
      expect(code).not.toMatch(/styles\.newProjectButton\b/);
    });

    it('does NOT render the "Recent" dropdown chip', () => {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/<Text[^>]*>Recent<\/Text>/);
      expect(code).not.toMatch(/styles\.recentChip\b/);
    });

    it('DOES still render the address TextInput with its anchor testID', () => {
      expect(src).toMatch(/<TextInput\b/);
      expect(src).toMatch(/testID=["']estimate-studio-address-input["']/);
      expect(src).toMatch(/placeholder=["']Enter property address\.\.\.["']/);
    });

    it('drops the compact + onNewProject props from the public API', () => {
      // The compact toggle existed only to hide the now-removed buttons,
      // and onNewProject only wired the now-removed "+ New Project" button.
      // Both must stay gone so callers don't pass dead props.
      expect(src).not.toMatch(/\bcompact\??\s*:/);
      expect(src).not.toMatch(/\bonNewProject\??\s*:/);
    });
  });

  describe('Lock #17: Scope tab uses shared shell + renders inline TruthBadges', () => {
    // Wave 7 (2026-05-17): Scope is THE tab where contractors read the plain-
    // English story. It MUST use the same CanvasCardSwitcher + BottomChipStrip
    // shells (so card geometry stays consistent across tabs) and MUST render
    // inline TruthBadge components in the story so contractors can instantly
    // tell observed-vs-derived-vs-assumed facts.
    const tabSrc = read(
      'components/service-hub/estimate-studio/scope/ScopeTab.tsx',
    );
    // 2026-05-25 — Legacy StoryPanel removed; StoryPanelV2 owns the
    // story surface end-to-end. The TruthBadge assertion that lived
    // here was scoped to the deleted file and has been retired with
    // the legacy component. Lock #31 (StoryPanelV2 layout) replaces
    // it for the V2 surface.
    const pageSrc = read('app/service-hub/estimate-studio/scope.tsx');

    it('uses <CanvasCardSwitcher /> for the main canvas region', () => {
      expect(tabSrc).toMatch(/CanvasCardSwitcher/);
      expect(tabSrc).toMatch(/<CanvasCardSwitcher\b/);
    });

    it('uses <BottomChipStrip /> for card selection', () => {
      expect(tabSrc).toMatch(/BottomChipStrip/);
      expect(tabSrc).toMatch(/<BottomChipStrip\b/);
    });

    it('empty state copy contains the literal "Drop a plan set in Plans & Photos"', () => {
      // Tonio: this is the contractor's entry breadcrumb when no project has
      // been uploaded. The literal must remain so the visible UX matches the
      // contract.
      expect(tabSrc).toMatch(/Drop a plan set in Plans & Photos/);
    });

    it('scope.tsx route delegates to <ScopeTab /> (no TabPlaceholder)', () => {
      expect(pageSrc).toMatch(/<ScopeTab\s*\/>/);
      expect(pageSrc).not.toMatch(/TabPlaceholder/);
    });
  });

  describe('Lock #18: Takeoff tab uses shared shells + mode-aware geometry', () => {
    // Wave 8 (2026-05-17): Takeoff is the Commercial Blueprint workspace. It
    // must reuse the Wave 6A shells so future modes (residential, smart-room,
    // roofing) inherit consistent geometry. The mode switcher has 4 pills:
    // Commercial + Residential enabled, Smart Room + Roofing disabled with
    // a "Phase 8" badge until Phase 8 ships.
    const tabSrc = read(
      'components/service-hub/estimate-studio/takeoff/TakeoffTab.tsx',
    );
    const pageSrc = read('app/service-hub/estimate-studio/takeoff.tsx');
    const modeSrc = read(
      'components/service-hub/estimate-studio/takeoff/ModeSwitcher.tsx',
    );
    const sheetViewerSrc = read(
      'components/service-hub/estimate-studio/takeoff/SheetViewer.tsx',
    );

    it('TakeoffTab uses <CanvasCardSwitcher /> via the mode container', () => {
      // The mode container hosts CanvasCardSwitcher — that's the shell reuse.
      const commercialSrc = read(
        'components/service-hub/estimate-studio/takeoff/CommercialBlueprintMode.tsx',
      );
      expect(commercialSrc).toMatch(/CanvasCardSwitcher/);
      expect(commercialSrc).toMatch(/<CanvasCardSwitcher\b/);
    });

    it('TakeoffTab uses <BottomChipStrip /> for card selection', () => {
      expect(tabSrc).toMatch(/BottomChipStrip/);
      expect(tabSrc).toMatch(/<BottomChipStrip\b/);
    });

    it('TakeoffTab uses 4 chips: Sheet Viewer / Assemblies / Quantities / Symbol Legend', () => {
      expect(tabSrc).toMatch(/key:\s*['"]sheet-viewer['"]/);
      expect(tabSrc).toMatch(/key:\s*['"]assemblies['"]/);
      expect(tabSrc).toMatch(/key:\s*['"]quantities['"]/);
      expect(tabSrc).toMatch(/key:\s*['"]legend['"]/);
      // Labels match the plan.
      expect(tabSrc).toMatch(/label:\s*['"]Sheet Viewer['"]/);
      expect(tabSrc).toMatch(/label:\s*['"]Assemblies['"]/);
      expect(tabSrc).toMatch(/label:\s*['"]Quantities['"]/);
      expect(tabSrc).toMatch(/label:\s*['"]Symbol Legend['"]/);
    });

    it('takeoff.tsx route delegates to <TakeoffTab /> (no TabPlaceholder)', () => {
      expect(pageSrc).toMatch(/<TakeoffTab\s*\/>/);
      expect(pageSrc).not.toMatch(/TabPlaceholder/);
    });

    it('ModeSwitcher exposes exactly four modes', () => {
      expect(modeSrc).toMatch(/key:\s*['"]commercial['"]/);
      expect(modeSrc).toMatch(/key:\s*['"]residential['"]/);
      expect(modeSrc).toMatch(/key:\s*['"]smart-room['"]/);
      expect(modeSrc).toMatch(/key:\s*['"]roofing['"]/);
    });

    it('Smart Room + Roofing modes are disabled with a Phase 8 badge', () => {
      // Each disabled mode must carry both `disabled: true` and badge:'Phase 8'.
      const smartRoomBlock = modeSrc.match(/key:\s*['"]smart-room['"][\s\S]{0,200}/);
      expect(smartRoomBlock).toBeTruthy();
      expect(smartRoomBlock![0]).toMatch(/disabled:\s*true/);
      expect(smartRoomBlock![0]).toMatch(/badge:\s*['"]Phase 8['"]/);

      const roofingBlock = modeSrc.match(/key:\s*['"]roofing['"][\s\S]{0,200}/);
      expect(roofingBlock).toBeTruthy();
      expect(roofingBlock![0]).toMatch(/disabled:\s*true/);
      expect(roofingBlock![0]).toMatch(/badge:\s*['"]Phase 8['"]/);
    });

    it('renders the Drop-a-plan-set empty-state copy when no project is loaded', () => {
      // Locked literal so reviewers always see the correct CTA when empty.
      expect(tabSrc).toMatch(/Drop a plan set in Plans & Photos/);
    });

    it('SymbolOverlay is reachable from SheetViewer (overlay toggle wired)', () => {
      expect(sheetViewerSrc).toMatch(/SymbolOverlay/);
      expect(sheetViewerSrc).toMatch(/<SymbolOverlay\b/);
      expect(sheetViewerSrc).toMatch(/symbol-overlay-toggle/);
    });

    it('TimRailContextTab branches on /takeoff and renders TakeoffContextPayload', () => {
      const railSrc = read(
        'components/service-hub/estimate-studio/tim-rail/TimRailContextTab.tsx',
      );
      expect(railSrc).toMatch(/pathname\.endsWith\(['"]\/takeoff['"]\)/);
      expect(railSrc).toMatch(/<TakeoffContextPayload\b/);
    });

    it('Push-to-materials is a YELLOW capability flow (scope materials.bundle.add)', () => {
      const routesSrc = read('server/routes.ts');
      // The new route must mint a token with the materials.bundle.add scope.
      expect(routesSrc).toMatch(/\/api\/v1\/blueprints\/projects\/:id\/push-to-materials/);
      expect(routesSrc).toMatch(/scope:\s*['"]materials\.bundle\.add['"]/);
      expect(routesSrc).toMatch(/risk_tier:\s*['"]yellow['"]/);
    });
  });

  describe('Lock #16: Plans & Photos canvas (revised 2026-05-18 — Canvas Cleanup)', () => {
    // 2026-05-18 user lock:
    //   "ONLY BLUEPRINTS ON CANVAS. Anything else is in the Context tab."
    //   "Visuals / Plans & Photos / etc tabs should be in Controls tab on Tim Rail."
    //   "Context tab is not premium enough — make it seamless."
    //
    // The Plans & Photos canvas is now a single focused surface: either
    // UploadDropZone (no project) or SheetThumbnailGrid (project ingested).
    // All chrome (stat row · view switcher · discipline filter · bottom chips)
    // moved to the Tim Rail Context tab. State is shared via plansPhotosUiStore.
    const tabSrc = read(
      'components/service-hub/estimate-studio/plans-photos/PlansPhotosTab.tsx',
    );
    const pageSrc = read('app/service-hub/estimate-studio/plans-photos.tsx');
    const gridSrc = read(
      'components/service-hub/estimate-studio/plans-photos/SheetThumbnailGrid.tsx',
    );

    it('canvas has NO BottomChipStrip / CanvasCardSwitcher chrome', () => {
      expect(tabSrc).not.toMatch(/<BottomChipStrip\b/);
      expect(tabSrc).not.toMatch(/<CanvasCardSwitcher\b/);
    });

    it('canvas renders <UploadDropZone /> for the upload card', () => {
      expect(tabSrc).toMatch(/<UploadDropZone\b/);
    });

    it('canvas renders <SheetThumbnailGrid /> for the populated Sheets card', () => {
      expect(tabSrc).toMatch(/<SheetThumbnailGrid\b/);
    });

    it('plans-photos.tsx route delegates to <PlansPhotosTab /> (no TabPlaceholder)', () => {
      expect(pageSrc).toMatch(/<PlansPhotosTab\s*\/>/);
      expect(pageSrc).not.toMatch(/TabPlaceholder/);
    });

    it('canvas tab subscribes to plansPhotosUiStore (active card lifted out)', () => {
      expect(tabSrc).toMatch(/plansPhotosUiStore/);
      expect(tabSrc).toMatch(/usePlansPhotosUi\(/);
    });

    it('canvas tab still subscribes to live polled state', () => {
      expect(tabSrc).toMatch(/useBlueprintProjectPoll/);
    });

    it('SheetThumbnailGrid has NO in-grid stat row or discipline filter strip', () => {
      expect(gridSrc).not.toMatch(/testID="grid-stat-sheets"/);
      expect(gridSrc).not.toMatch(/testID="grid-stat-disciplines"/);
      expect(gridSrc).not.toMatch(/testID="grid-stat-revisions"/);
      expect(gridSrc).not.toMatch(/discipline-filter-\$\{f\.code\}/);
      expect(gridSrc).not.toMatch(/function SkeletonStat\b/);
      expect(gridSrc).not.toMatch(/function AnimatedCount\b/);
    });

    it('SheetThumbnailGrid consumes filterKey from plansPhotosUiStore', () => {
      expect(gridSrc).toMatch(/usePlansPhotosUi/);
      expect(gridSrc).toMatch(/const filterKey = ui\.filterKey/);
    });

    it('grid host flexes + keeps a >= 320 minHeight floor (CLS=0 across viewports)', () => {
      const hostMatch = gridSrc.match(/host:\s*\{[\s\S]*?\n\s{2}\}/);
      expect(hostMatch).toBeTruthy();
      expect(hostMatch![0]).toMatch(/\bflex:\s*1\b/);
      expect(hostMatch![0]).not.toMatch(/\baspectRatio\s*:/);
      const minH = hostMatch![0].match(/minHeight:\s*(\d+)/);
      expect(minH).toBeTruthy();
      expect(Number(minH![1])).toBeGreaterThanOrEqual(320);
    });

    it('renders the CURRENT revision-chain pill on the active sheet', () => {
      expect(gridSrc).toMatch(/CURRENT/);
      expect(gridSrc).toMatch(/currentPill:/);
    });
  });

  // -------------------------------------------------------------------------
  // Lock #23 — Plans & Photos canvas is blueprints only.
  // -------------------------------------------------------------------------
  describe('Lock #23: Plans & Photos canvas = blueprints only (2026-05-18)', () => {
    const tabSrc = read(
      'components/service-hub/estimate-studio/plans-photos/PlansPhotosTab.tsx',
    );
    const gridSrc = read(
      'components/service-hub/estimate-studio/plans-photos/SheetThumbnailGrid.tsx',
    );

    it('PlansPhotosTab does not render the 6 estimate-studio tab pills', () => {
      expect(tabSrc).not.toMatch(/EstimateStudioTabBar/);
    });

    it('PlansPhotosTab does not render an inline stage chip strip', () => {
      // Stage progress lives in the Context tab (DrewStageProgress +
      // UploadProgressInline). Canvas no longer narrates the pipeline.
      expect(tabSrc).not.toMatch(/UploadProgressInline/);
      expect(tabSrc).not.toMatch(/<DrewStageProgress/);
    });

    it('PlansPhotosTab does not render a counter row', () => {
      expect(tabSrc).not.toMatch(/counter-sheets/);
      expect(tabSrc).not.toMatch(/counter-disciplines/);
      expect(tabSrc).not.toMatch(/counter-revisions/);
    });

    it('PlansPhotosTab does not render a discipline filter chip row', () => {
      expect(tabSrc).not.toMatch(/discipline-filter-/);
    });

    it('PlansPhotosTab does not render the bottom action chip strip', () => {
      expect(tabSrc).not.toMatch(/<BottomChipStrip\b/);
      expect(tabSrc).not.toMatch(/bottom-chip-/);
    });

    it('SheetThumbnailGrid is grid-only — no embedded chrome', () => {
      expect(gridSrc).not.toMatch(/filterStripScroll/);
      expect(gridSrc).not.toMatch(/testID="grid-stat-/);
    });
  });

  // -------------------------------------------------------------------------
  // Lock #24 — Tim Rail Controls tab owns the 6 route pills + Upload + New
  // -------------------------------------------------------------------------
  describe('Lock #24: Tim Rail Controls tab is the single source of nav (2026-05-18)', () => {
    const ctrlSrc = read(
      'components/service-hub/estimate-studio/tim-rail/TimRailControlsTab.tsx',
    );

    it('declares all 6 estimate-studio routes in STUDIO_TABS', () => {
      const declMatch = ctrlSrc.match(/STUDIO_TABS[\s\S]*?\];/);
      expect(declMatch).toBeTruthy();
      const decl = declMatch![0];
      for (const route of [
        '/service-hub/estimate-studio/visuals',
        '/service-hub/estimate-studio/plans-photos',
        '/service-hub/estimate-studio/scope',
        '/service-hub/estimate-studio/materials',
        '/service-hub/estimate-studio/takeoff',
        '/service-hub/estimate-studio/estimate',
      ]) {
        expect(decl).toContain(route);
      }
    });

    it('renders a PROJECT section, NAVIGATE section, and QUICK ACTIONS section', () => {
      expect(ctrlSrc).toMatch(/tim-rail-controls-project/);
      expect(ctrlSrc).toMatch(/tim-rail-controls-navigate/);
      expect(ctrlSrc).toMatch(/tim-rail-controls-actions/);
    });

    it('QUICK ACTIONS exposes Upload + New Project (a11y-labelled)', () => {
      expect(ctrlSrc).toMatch(/tim-rail-controls-upload/);
      expect(ctrlSrc).toMatch(/tim-rail-controls-new-project/);
      expect(ctrlSrc).toMatch(/accessibilityLabel="Upload project evidence"/);
      expect(ctrlSrc).toMatch(/accessibilityLabel="Start a new estimate project"/);
    });

    it('NAVIGATE renders a vertical pill stack (not a 2-col grid)', () => {
      // The vertical stack is identified by `tim-rail-controls-pill-stack`
      // and the `tabStack` style block (flexDirection: 'column').
      expect(ctrlSrc).toMatch(/tim-rail-controls-pill-stack/);
      expect(ctrlSrc).toMatch(/tabStack:\s*\{[\s\S]*?flexDirection:\s*'column'/);
      // The old 2-col grid style is gone.
      expect(ctrlSrc).not.toMatch(/tabGrid:\s*\{/);
    });
  });

  // -------------------------------------------------------------------------
  // Lock #25 — Tim Rail Context tab payload composition for Plans & Photos
  // -------------------------------------------------------------------------
  describe('Lock #25: Plans & Photos Context payload composition (2026-05-18)', () => {
    const ctxSrc = read(
      'components/service-hub/estimate-studio/tim-rail/PlansPhotosContextPayload.tsx',
    );

    it('declares the required section keys in the locked order', () => {
      // The payload composition is the user-locked seamless premium order.
      // We anchor on the `key: 'X',\n      title: ...` shape of a
      // ContextSection literal (title follows key on the next line) so that
      // VIEW_MODES / DISCIPLINE_FILTERS entries (which carry `icon:` or
      // `code:` next) are skipped.
      const sectionKeyRe = /key:\s*'([a-z-]+)',\s*\n\s+title:/g;
      const keys = Array.from(ctxSrc.matchAll(sectionKeyRe)).map((m) => m[1]);
      const required = ['counters', 'pipeline', 'view', 'filter', 'disciplines', 'last-upload'];
      const filteredKeys = keys.filter((k) => required.includes(k));
      expect(filteredKeys).toEqual(required);
    });

    it('Live Counters strip includes sheets · disciplines · revisions · materials', () => {
      expect(ctxSrc).toMatch(/testID="context-counter-sheets"/);
      expect(ctxSrc).toMatch(/testID="context-counter-disciplines"/);
      expect(ctxSrc).toMatch(/testID="context-counter-revisions"/);
      expect(ctxSrc).toMatch(/testID="context-counter-materials"/);
    });

    it('Pipeline Status section uses the vertical UploadProgressInline', () => {
      expect(ctxSrc).toMatch(/UploadProgressInline/);
      expect(ctxSrc).toMatch(/layout="vertical"/);
    });

    it('View switcher exposes All Sheets · By Discipline · Revisions', () => {
      expect(ctxSrc).toMatch(/testID="context-view-switcher"/);
      // Template-literal testID: testID={`context-view-${mode.key}`}
      expect(ctxSrc).toMatch(/testID=\{`context-view-\$\{mode\.key\}`\}/);
      // VIEW_MODES declaration must include sheets / disciplines / revisions.
      const declMatch = ctxSrc.match(/VIEW_MODES[\s\S]*?\];/);
      expect(declMatch).toBeTruthy();
      const decl = declMatch![0];
      expect(decl).toMatch(/key:\s*'sheets'/);
      expect(decl).toMatch(/key:\s*'disciplines'/);
      expect(decl).toMatch(/key:\s*'revisions'/);
    });

    it('Discipline filter strip declares All + 8 AIA codes', () => {
      expect(ctxSrc).toMatch(/testID="context-filter-strip"/);
      const declMatch = ctxSrc.match(/DISCIPLINE_FILTERS[\s\S]*?\];/);
      expect(declMatch).toBeTruthy();
      const decl = declMatch![0];
      expect(decl).toMatch(/code:\s*'All'/);
      for (const code of ['A', 'S', 'M', 'E', 'P', 'FP', 'C', 'L']) {
        expect(decl).toMatch(new RegExp(`code:\\s*'${code}'`));
      }
    });

    it('mutates active card + filter via the shared plansPhotosUiStore', () => {
      expect(ctxSrc).toMatch(/plansPhotosUiActions/);
      expect(ctxSrc).toMatch(/setActiveCard/);
      expect(ctxSrc).toMatch(/setFilterKey/);
    });
  });

  // -------------------------------------------------------------------------
  // Lock #26 — Estimate Studio canvas header has ZERO chrome buttons.
  // The property address bar is the ONLY affordance the canvas header owns.
  // Upload, "+ New Project", and "Recent ▾" all live in Tim Rail Controls.
  // Lock added 2026-05-18 after the regression where e127801's hide-chrome
  // pass only suppressed chrome above 768px — the prior shell still mounted
  // EstimateStudioHeader + EstimateStudioTabBar + ProjectAddressBar (with
  // Upload + New Project) below 768. This lock prevents that path returning.
  // -------------------------------------------------------------------------
  describe('Lock #26: Estimate Studio canvas header is address-only (2026-05-18)', () => {
    const shellSrc = read(
      'components/service-hub/estimate-studio/EstimateStudioShell.tsx',
    );
    const addrSrc = read(
      'components/service-hub/estimate-studio/ProjectAddressBar.tsx',
    );

    it('EstimateStudioShell does not import EstimateStudioHeader', () => {
      expect(shellSrc).not.toMatch(/import\s*\{[^}]*EstimateStudioHeader[^}]*\}\s*from/);
    });

    it('EstimateStudioShell does not import EstimateStudioTabBar', () => {
      expect(shellSrc).not.toMatch(/import\s*\{[^}]*EstimateStudioTabBar[^}]*\}\s*from/);
    });

    it('EstimateStudioShell does not import ProjectAddressBar into the canvas', () => {
      // Address bar is owned by Tim Rail Controls now (PROJECT section).
      expect(shellSrc).not.toMatch(/import\s*\{[^}]*ProjectAddressBar[^}]*\}\s*from/);
    });

    it('EstimateStudioShell does not render the address / header / tabbar JSX', () => {
      expect(shellSrc).not.toMatch(/<EstimateStudioHeader\b/);
      expect(shellSrc).not.toMatch(/<EstimateStudioTabBar\b/);
      expect(shellSrc).not.toMatch(/<ProjectAddressBar\b/);
    });

    it('ProjectAddressBar renders ONLY the input — no Upload / New Project / Recent buttons', () => {
      // Source comments may reference these names (Wave 0 history); the
      // rendered JSX must not. We check for button labels in JSX text nodes.
      expect(addrSrc).not.toMatch(/<Text[^>]*>\s*Upload\s*</);
      expect(addrSrc).not.toMatch(/<Text[^>]*>\s*\+\s*New Project\s*</);
      expect(addrSrc).not.toMatch(/<Text[^>]*>\s*Recent\s*</);
      // And no Recent-dropdown chrome anywhere.
      expect(addrSrc).not.toMatch(/recent-dropdown/i);
      expect(addrSrc).not.toMatch(/new-project-button/i);
    });
  });

  describe('Lock #20: Service Memory pages clone Office Memory at /service-hub/memory/*', () => {
    // Wave 5.1b-6 + 5.1b-7 (2026-05-17): Service Memory mirrors Office Memory
    // byte-for-byte at /service-hub/memory/*. This lock asserts:
    //   (1) The previous ComingSoonStub at app/service-hub/memory.tsx is gone.
    //   (2) The three sub-pages exist under app/service-hub/memory/.
    //   (3) The hero title literal is "Service Memory" (not Memory Engine).
    //   (4) Pages REUSE the office-memory components (no duplication of
    //       MemoryCard / MemoryResultsGrid / MemoryFilterBar / MemoryGridListToggle
    //       / MemoryDetailHeader / LedAmbientSearchBar). The 85% reuse target
    //       is enforced by checking the imports trace back to office-memory.
    const indexSrc = read('app/service-hub/memory/index.tsx');
    const resultsSrc = read('app/service-hub/memory/results.tsx');
    const detailSrc = read('app/service-hub/memory/[memoryId].tsx');
    const heroSrc = read('components/service-hub/ServiceMemoryHero.tsx');

    it('the old ComingSoonStub at app/service-hub/memory.tsx no longer exists', () => {
      // The directory-only structure (memory/index.tsx, memory/results.tsx,
      // memory/[memoryId].tsx) replaces the flat memory.tsx file.
      const fs = require('node:fs');
      const stubPath = join(ROOT, 'app/service-hub/memory.tsx');
      expect(fs.existsSync(stubPath)).toBe(false);
    });

    it('hero component renders the literal title "Service Memory"', () => {
      // Anchored as a JSX child between `>` and `<` so doc-comments don't
      // accidentally satisfy the match.
      expect(heroSrc).toMatch(/>\s*Service Memory\s*</);
    });

    it('hero subtitle matches the service desk copy', () => {
      expect(heroSrc).toMatch(
        /Search every job, blueprint, material decision, and call your service desk has captured\./,
      );
    });

    it('index.tsx imports ServiceMemoryHero (not MemoryEngineHero)', () => {
      expect(indexSrc).toMatch(/import\s+\{\s*ServiceMemoryHero\s*\}/);
      expect(indexSrc).not.toMatch(/import\s+\{\s*MemoryEngineHero\s*\}/);
    });

    it('results.tsx reuses the office-memory grid + filter + toggle components', () => {
      expect(resultsSrc).toMatch(/from\s+['"]@\/components\/office-memory\/MemoryFilterBar['"]/);
      expect(resultsSrc).toMatch(
        /from\s+['"]@\/components\/office-memory\/MemoryGridListToggle['"]/,
      );
      expect(resultsSrc).toMatch(
        /from\s+['"]@\/components\/office-memory\/MemoryResultsGrid['"]/,
      );
    });

    it('results.tsx calls useServiceMemorySearch (not useMemorySearch)', () => {
      expect(resultsSrc).toMatch(
        /from\s+['"]@\/lib\/service-memory\/useServiceMemorySearch['"]/,
      );
      expect(resultsSrc).toMatch(/useServiceMemorySearch\s*\(/);
    });

    it('results.tsx page header reads "Service Memory Results"', () => {
      expect(resultsSrc).toMatch(/>\s*Service Memory Results\s*</);
    });

    it('detail page reuses MemoryDetailHeader from office-memory barrel', () => {
      expect(detailSrc).toMatch(
        /from\s+['"]@\/components\/office-memory\/details['"]/,
      );
      expect(detailSrc).toMatch(/MemoryDetailHeader/);
    });

    it('detail page swaps to ServiceMemoryDetailRightRail (not the office rail)', () => {
      expect(detailSrc).toMatch(
        /import\s+\{\s*ServiceMemoryDetailRightRail\s*\}/,
      );
      expect(detailSrc).toMatch(/<ServiceMemoryDetailRightRail\b/);
      // The office rail must NOT be imported here — the service rail is
      // service-specific because its LINKED_MEMORY_TYPES set differs.
      expect(detailSrc).not.toMatch(
        /import\s+\{[^}]*\bMemoryDetailRightRail\b[^}]*\}\s+from\s+['"]@\/components\/office-memory\/details['"]/,
      );
    });

    it('detail page calls useServiceMemoryDetail and deep-links back to /service-hub/memory', () => {
      expect(detailSrc).toMatch(
        /from\s+['"]@\/lib\/service-memory\/useServiceMemoryDetail['"]/,
      );
      expect(detailSrc).toMatch(/useServiceMemoryDetail\s*\(/);
      expect(detailSrc).toMatch(/['"]\/service-hub\/memory['"]/);
    });

    it('hero reuses the LedAmbientSearchBar from office-memory (no duplication)', () => {
      expect(heroSrc).toMatch(
        /from\s+['"]@\/components\/office-memory\/LedAmbientSearchBar['"]/,
      );
    });
  });

  describe('Lock #21: Tim Rail Context renders ServiceBriefCard on Service Hub routes', () => {
    // Wave 5.1b (2026-05-17): Service Hub views (excluding Estimate Studio
    // sub-tabs that have their own per-tab Context payload + the Materials
    // tab) must surface a Service Memory brief summary card in the Tim Rail
    // Context tab. This lock catches regressions where someone removes the
    // card or accidentally renders it on the Estimate Studio sub-tabs.
    const railSrc = read(
      'components/service-hub/estimate-studio/tim-rail/TimRailContextTab.tsx',
    );
    const cardSrc = read('components/service-hub/ServiceBriefCard.tsx');

    it('TimRailContextTab imports and references ServiceBriefCard', () => {
      expect(railSrc).toMatch(/import\s+\{\s*ServiceBriefCard\s*\}/);
      expect(railSrc).toMatch(/<ServiceBriefCard\b/);
    });

    it('TimRailContextTab gates ServiceBriefCard on isServiceHubRoute', () => {
      expect(railSrc).toMatch(/isServiceHubRoute/);
      expect(railSrc).toMatch(/pathname\.startsWith\(['"]\/service-hub['"]\)/);
    });

    it('ServiceBriefCard is suppressed on Estimate Studio sub-tabs', () => {
      // The render must negate the Estimate Studio sub-tab booleans so each
      // tab's bespoke Context payload (Plans & Photos / Scope / Takeoff)
      // continues to render unchanged.
      expect(railSrc).toMatch(/!isPlansPhotosTab/);
      expect(railSrc).toMatch(/!isScopeTab/);
      expect(railSrc).toMatch(/!isTakeoffTab/);
    });

    it('ServiceBriefCard renders exactly 5 service counters', () => {
      expect(cardSrc).toMatch(/service-brief-counter-picks/);
      expect(cardSrc).toMatch(/service-brief-counter-overrides/);
      expect(cardSrc).toMatch(/service-brief-counter-pending/);
      expect(cardSrc).toMatch(/service-brief-counter-handoffs/);
      expect(cardSrc).toMatch(/service-brief-counter-threads/);
    });

    it('ServiceBriefCard "View all" deep-links to /service-hub/memory', () => {
      expect(cardSrc).toMatch(/\/service-hub\/memory/);
    });
  });

  describe('Lock #15: DrewStageProgress lives in Tim Rail Context, canvas stays calm', () => {
    const src = read(
      'components/service-hub/estimate-studio/plans-photos/DrewStageProgress.tsx',
    );
    const dzSrc = read(
      'components/service-hub/estimate-studio/plans-photos/UploadDropZone.tsx',
    );
    const ctxPayloadSrc = read(
      'components/service-hub/estimate-studio/tim-rail/PlansPhotosContextPayload.tsx',
    );

    it('declares all 5 pipeline stages in canonical order', () => {
      // The STAGES array must contain INGEST → CLASSIFY → SEE → REASON → PROCURE
      // exactly once each, in order. Order drift here = silent UX regression.
      const stageKeys = ['ingest', 'classify', 'see', 'reason', 'procure'];
      let cursor = 0;
      for (const key of stageKeys) {
        const idx = src.indexOf(`key: '${key}'`, cursor);
        expect(idx).toBeGreaterThan(cursor - 1);
        cursor = idx + 1;
      }
    });

    it('keeps DrewStageProgress host minHeight stable to enforce CLS = 0', () => {
      // Host minHeight must be >= 520 so narration/insight swaps never
      // reflow the Tim Rail Context tab.
      expect(src).toMatch(/minHeight:\s*520/);
    });

    it('canvas UploadDropZone does NOT render DrewStageProgress (canvas-clutter prevention)', () => {
      // Locked design rule: canvas hosts ONE focused element. Stage timeline,
      // narration, insights, sheet thumbnail rail — all of it belongs in the
      // Tim Rail Context tab, NEVER the canvas. This is the test that caught
      // and reverted the Wave 6A.1 cinematic-on-canvas regression.
      expect(dzSrc).not.toMatch(/<DrewStageProgress/);
      expect(dzSrc).not.toMatch(/from ['"].*DrewStageProgress['"]/);
    });

    it('canvas UploadDropZone shows a clean loading state during busy phases', () => {
      // Busy phase canvas = loading ring + filename + elapsed timer. Nothing
      // else. Verify the busy block exists and renders the calm LoadingRing.
      expect(dzSrc).toMatch(
        /phase === 'reading' \|\| phase === 'uploading' \|\| phase === 'ingesting' \|\| phase === 'classifying'/,
      );
      expect(dzSrc).toMatch(/LoadingRing/);
      expect(dzSrc).toMatch(/Drew is analyzing your blueprint/);
    });

    it('canvas UploadDropZone keeps busy footprint identical to idle (CLS = 0)', () => {
      // hostBusy minHeight matches idle (320) so phase transitions never
      // reflow the canvas.
      expect(dzSrc).toMatch(/hostBusy:\s*\{[\s\S]*?minHeight:\s*320/);
    });

    it('Tim Rail Context payload mounts DrewStageProgress while busy (plans-photos route)', () => {
      // The cinematic 5-stage timeline + narration + insights + thumbnail
      // rail render HERE — only in the Tim Rail Context tab, only while a
      // blueprint upload is in-progress on the Plans & Photos route.
      expect(ctxPayloadSrc).toMatch(/from ['"]\.\.\/plans-photos\/DrewStageProgress['"]/);
      expect(ctxPayloadSrc).toMatch(/<DrewStageProgress/);
      // Busy-phase gate: only show cinematic display during reading/uploading/ingesting/classifying.
      expect(ctxPayloadSrc).toMatch(/isBusy\s*=/);
      expect(ctxPayloadSrc).toMatch(/snap\.phase === 'reading'/);
      expect(ctxPayloadSrc).toMatch(/snap\.phase === 'classifying'/);
    });

    it('renders a sheet thumbnail rail (placeholder shimmer for Wave 6A.1)', () => {
      expect(src).toMatch(/SHEET MANIFEST/);
      expect(src).toMatch(/thumbRow:/);
    });

    it('rotates narration in Drews voice (not generic loading copy)', () => {
      // Verifies the narration strings carry Drew's voice — terse, expert.
      // Catches accidental swaps to generic "Loading…" placeholders.
      expect(src).toMatch(/Splitting the PDF/);
      expect(src).toMatch(/YOLOv11/);
      expect(src).toMatch(/Section 232/);
    });
  });

  describe('Lock #22: Materials tab "From your blueprint" auto-prepend (Wave 18h)', () => {
    // Wave 18h (2026-05-21): Blueprint is no longer a third toggle. When a
    // blueprint project is loaded, Drew's curated materials auto-prepend in
    // Tool mode and Adam's blueprint-derived supplier matches auto-prepend
    // in Supplier mode, both under a "From your blueprint" section header.
    // Project-gated (deny-by-default per Law #3 — when no project_id exists
    // the surface is hidden entirely). The legacy FromBlueprintCard +
    // MaterialOverridePanel components remain on disk but are no longer
    // mounted by MaterialsTab; their internal shape locks still apply so
    // the YELLOW override flow can be reintroduced cleanly.
    const tabSrc = read(
      'components/service-hub/estimate-studio/materials/MaterialsTab.tsx',
    );
    const cardSrc = read(
      'components/service-hub/estimate-studio/materials/FromBlueprintCard.tsx',
    );
    const panelSrc = read(
      'components/service-hub/estimate-studio/materials/MaterialOverridePanel.tsx',
    );
    const ctxSrc = read(
      'components/service-hub/estimate-studio/tim-rail/PlansPhotosContextPayload.tsx',
    );
    const routesSrc = read('server/routes.ts');

    it('blueprint prepend renders ONLY when a blueprint project exists', () => {
      // Project-gated: the prepend JSX must be guarded by hasBlueprintData
      // (which requires a non-null projectId) to enforce deny-by-default.
      expect(tabSrc).toMatch(/showBlueprintPrepend/);
      expect(tabSrc).toMatch(/hasBlueprintData/);
    });

    it('Tool mode prepends BlueprintModeFeed above generic results', () => {
      expect(tabSrc).toMatch(/testID="materials-blueprint-prepend-tool"/);
      expect(tabSrc).toMatch(/<BlueprintModeFeed\b/);
    });

    it('Supplier mode prepends a blueprint-derived supplier rail', () => {
      expect(tabSrc).toMatch(/testID="materials-blueprint-prepend-supplier"/);
      expect(tabSrc).toMatch(/deriveBlueprintSuppliers/);
    });

    it('mode toggle is 2-state (Blueprint segment removed)', () => {
      const toggleSrc = read(
        'components/service-hub/estimate-studio/materials/MaterialsModeToggle.tsx',
      );
      const barSrc = read(
        'components/service-hub/estimate-studio/materials/MaterialsSearchBar.tsx',
      );
      expect(toggleSrc).not.toMatch(/value:\s*'blueprint'/);
      expect(barSrc).not.toMatch(/value:\s*'blueprint'/);
    });

    it('FromBlueprintCard exposes Confirm · Override · Skip actions per row', () => {
      // The three per-row actions must be present as discrete pressables so
      // contractors can act on Drew's picks without leaving the canvas.
      expect(cardSrc).toMatch(/from-blueprint-confirm-/);
      expect(cardSrc).toMatch(/from-blueprint-override-/);
      expect(cardSrc).toMatch(/from-blueprint-skip-/);
    });

    it('FromBlueprintCard groups picks by category (deny-by-default category map)', () => {
      // The five PROCURE categories MUST be enumerated explicitly. Adding a
      // new category requires updating CATEGORY_LABEL + ICON in lockstep so
      // the rendering never silently drops an unknown bucket.
      expect(cardSrc).toMatch(/commodity:\s*['"]Commodity['"]/);
      expect(cardSrc).toMatch(/commercial_plumbing:\s*['"]Commercial Plumbing['"]/);
      expect(cardSrc).toMatch(/appliance_finish:\s*['"]Appliance & Finish['"]/);
      expect(cardSrc).toMatch(/local_trade:\s*['"]Local Trade['"]/);
      expect(cardSrc).toMatch(/specialty_hardware:\s*['"]Specialty Hardware['"]/);
    });

    it('Override panel mounts a Modal and presents a Confirm Override CTA', () => {
      // The slide-in panel acts as the YELLOW UX gate (Law #4). It must use
      // a Modal so the canvas behind dims, and the Confirm Override CTA is
      // the only path that fires the mutation.
      expect(panelSrc).toMatch(/<Modal\b/);
      expect(panelSrc).toMatch(/material-override-confirm/);
      expect(panelSrc).toMatch(/material-override-cancel/);
      expect(panelSrc).toMatch(/Confirm override/);
    });

    it('Tim Rail counter strip now includes a "materials" cell', () => {
      // The Live Counters strip gains a 4th cell so contractors see Drew's
      // PROCURE output land in real time without leaving Plans & Photos.
      expect(ctxSrc).toMatch(/testID="context-counter-materials"/);
      expect(ctxSrc).toMatch(/useTakeoffMaterials/);
    });

    it('Express proxy registers the YELLOW material-override route', () => {
      // The thin proxy is required so Drew's MATERIAL_OVERRIDE task can be
      // invoked with a minted capability token (Law #5). Without this route
      // the FE override panel would 404.
      expect(routesSrc).toMatch(
        /\/api\/v1\/blueprints\/projects\/:id\/materials\/:material_id\/override/,
      );
      expect(routesSrc).toMatch(/scope:\s*['"]blueprints:material_override['"]/);
      expect(routesSrc).toMatch(/task:\s*['"]MATERIAL_OVERRIDE['"]/);
    });

    it('Express proxy registers the YELLOW material-skip route', () => {
      expect(routesSrc).toMatch(
        /\/api\/v1\/blueprints\/projects\/:id\/materials\/:material_id\/skip/,
      );
      expect(routesSrc).toMatch(/scope:\s*['"]blueprints:material_skip['"]/);
      expect(routesSrc).toMatch(/task:\s*['"]MATERIAL_SKIP['"]/);
    });
  });

  // -------------------------------------------------------------------------
  // Lock #27 — BlueprintFailureCard mounts when the pipeline dies.
  // Before this lock landed, a stage_progress.ingest === 'failed' left the
  // Plans & Photos canvas spinning a shimmer forever — the user stared at
  // frozen UI for 8+ minutes on a single dead project. Lock asserts the
  // failure card exists, the canvas tab wires it in, and the wire-up is
  // gated on the polled hasFailed signal (not on `upload.phase === 'error'`,
  // which never flipped on the async-dispatch path).
  // -------------------------------------------------------------------------
  describe('Lock #27: BlueprintFailureCard mounts on stage failure (2026-05-19)', () => {
    const cardSrc = read(
      'components/service-hub/estimate-studio/plans-photos/BlueprintFailureCard.tsx',
    );
    const tabSrc = read(
      'components/service-hub/estimate-studio/plans-photos/PlansPhotosTab.tsx',
    );

    it('BlueprintFailureCard component file exists with the testID anchor', () => {
      expect(cardSrc).toMatch(/testID = 'blueprint-failure-card'/);
      expect(cardSrc).toMatch(/testID="blueprint-failure-retry"/);
      expect(cardSrc).toMatch(/testID="blueprint-failure-start-over"/);
    });

    it('BlueprintFailureCard ships per-stage Drew copy for all 5 pipeline stages', () => {
      // Each stage must have a one-line subtitle so the user knows WHICH
      // provider died. Generic-only copy would silently hide root cause.
      const stageCopyMatch = cardSrc.match(/STAGE_COPY[\s\S]*?\};/);
      expect(stageCopyMatch).toBeTruthy();
      const decl = stageCopyMatch![0];
      for (const stage of ['ingest', 'classify', 'see', 'reason', 'procure']) {
        expect(decl).toMatch(new RegExp(`${stage}:\\s*\\{`));
      }
    });

    it('PlansPhotosTab imports BlueprintFailureCard and mounts it on hasFailed', () => {
      expect(tabSrc).toMatch(
        /import\s*\{\s*BlueprintFailureCard\s*\}\s*from\s*['"]\.\/BlueprintFailureCard['"]/,
      );
      // The render must short-circuit on poll.hasFailed, NOT on
      // upload.phase === 'error' (which the async-dispatch path never sets).
      expect(tabSrc).toMatch(/poll\.hasFailed/);
      expect(tabSrc).toMatch(/<BlueprintFailureCard/);
    });

    it('PlansPhotosTab wires retry to upload.retry and start-over to upload.reset', () => {
      expect(tabSrc).toMatch(/onRetry=\{upload\.retry\}/);
      expect(tabSrc).toMatch(/onStartOver=\{upload\.reset\}/);
    });

    it('failure card mount path is decoupled from activeCard (renders over ALL view modes)', () => {
      // failureCard must be ?? card (or equivalent short-circuit), not
      // gated inside the activeCard switch — so a user on "By Discipline"
      // still sees the failure card when Drew dies.
      expect(tabSrc).toMatch(/failureCard\s*\?\?\s*card/);
    });
  });

  // -------------------------------------------------------------------------
  // Lock #28 — useBlueprintProjectPoll STOPS polling on hasFailed.
  // Continuing to poll a dead project burned 30 requests/min on the user's
  // failed run before the timeout. The poll cadence helper must return
  // null (= stop) the moment any stage reaches the 'error' terminal state.
  // -------------------------------------------------------------------------
  describe('Lock #28: useBlueprintProjectPoll halts on failure (2026-05-19)', () => {
    const hookSrc = read('hooks/useBlueprintProjectPoll.ts');

    it('exposes hasFailed, failedStage, failureSummary on the hook surface', () => {
      expect(hookSrc).toMatch(/hasFailed:\s*boolean/);
      expect(hookSrc).toMatch(/failedStage:\s*StageKey\s*\|\s*null/);
      expect(hookSrc).toMatch(/failureSummary:\s*BlueprintFailureSummary\s*\|\s*null/);
    });

    it('_nextIntervalMs returns null when any stage has failed', () => {
      // The fail-closed branch must run BEFORE the "running" / "procure
      // done" branches so a transient running cousin can't keep polling
      // alive after a sibling has died.
      const fnMatch = hookSrc.match(/function _nextIntervalMs[\s\S]*?\n\}/);
      expect(fnMatch).toBeTruthy();
      const fn = fnMatch![0];
      expect(fn).toMatch(/_firstFailedStage\([^)]+\)\s*!==\s*null/);
      expect(fn).toMatch(/return null/);
    });

    it('derives failedStage in canonical pipeline order (upstream wins)', () => {
      // _firstFailedStage must iterate STAGE_KEYS in canonical order so
      // an INGEST failure surfaces even if downstream stages also error.
      const fnMatch = hookSrc.match(/function _firstFailedStage[\s\S]*?\n\}/);
      expect(fnMatch).toBeTruthy();
      const fn = fnMatch![0];
      expect(fn).toMatch(/for\s*\(\s*const\s+k\s+of\s+STAGE_KEYS\s*\)/);
      expect(fn).toMatch(/p\[k\]\s*===\s*'error'/);
    });
  });

  // -------------------------------------------------------------------------
  // Lock #29 — Context tab surfaces the failure with a red mini-chip.
  // The user must see "pipeline failed at X — see canvas to retry" without
  // having to click into Plans & Photos. The Pipeline Status timeline
  // already renders red alert-circle glyphs via _statusGlyph(error) in
  // UploadProgressInline; this lock asserts both wiring points.
  // -------------------------------------------------------------------------
  describe('Lock #29: Context tab surfaces pipeline failures (2026-05-19)', () => {
    const ctxSrc = read(
      'components/service-hub/estimate-studio/tim-rail/PlansPhotosContextPayload.tsx',
    );
    const progressSrc = read(
      'components/service-hub/estimate-studio/plans-photos/UploadProgressInline.tsx',
    );

    it('renders a red failure mini-chip when poll.hasFailed is true', () => {
      expect(ctxSrc).toMatch(/testID="context-failure-chip"/);
      expect(ctxSrc).toMatch(/poll\.hasFailed/);
      // Chip uses the canonical red (#ef4444) — must NOT slip back to amber.
      expect(ctxSrc).toMatch(/#ef4444/);
    });

    it('UploadProgressInline renders a red alert-circle on stage status === "error"', () => {
      // _statusGlyph(error) must emit the red glyph so the per-stage
      // chip in the vertical Pipeline Status timeline turns red on the
      // failed stage. This is the dimmed/timeline indicator the spec
      // calls "red error icon (Ionicons close-circle)" — alert-circle
      // is the established canvas convention and matches the failure
      // card icon family.
      expect(progressSrc).toMatch(/case 'error':[\s\S]*?icon:\s*'alert-circle'[\s\S]*?color:\s*'#ef4444'/);
    });
  });

  // -------------------------------------------------------------------------
  // Lock #30 — Retry plumbing retains the File and re-uploads.
  // The store must carry the File reference across the entire lifecycle
  // (idle -> processing -> failed -> retry), and useBlueprintUpload.retry
  // must call upload() with that retained file.
  // -------------------------------------------------------------------------
  describe('Lock #30: Retry plumbing retains the File for re-upload (2026-05-19)', () => {
    const storeSrc = read('lib/blueprintUploadStore.ts');
    const hookSrc = read('hooks/useBlueprintUpload.ts');

    it('BlueprintUploadSnapshot carries a `file: File | null` field', () => {
      expect(storeSrc).toMatch(/file:\s*File\s*\|\s*null/);
    });

    it('useBlueprintUpload exposes a retry() method', () => {
      expect(hookSrc).toMatch(/retry:\s*\(\)\s*=>\s*Promise<void>/);
      // retry() must call upload(f) with the retained ref — NOT prompt
      // the user, NOT spawn a new file picker, NOT reset state.
      const fnMatch = hookSrc.match(/const retry = useCallback[\s\S]*?\}, \[upload\]\);/);
      expect(fnMatch).toBeTruthy();
      const fn = fnMatch![0];
      expect(fn).toMatch(/lastFileRef\.current/);
      expect(fn).toMatch(/await upload\(f\)/);
    });

    it('upload() retains the File before validation so retry survives reset paths', () => {
      // lastFileRef.current = file must be set early in upload() so even
      // a failed validation doesn't blank the retained reference.
      expect(hookSrc).toMatch(/lastFileRef\.current = file/);
    });

    it('reset() clears the retained file (Start over = clean slate)', () => {
      // The "Start over" affordance on the failure card must wipe the
      // file so the next upload starts truly fresh.
      const fnMatch = hookSrc.match(/const reset = useCallback[\s\S]*?\}, \[\]\);/);
      expect(fnMatch).toBeTruthy();
      const fn = fnMatch![0];
      expect(fn).toMatch(/lastFileRef\.current = null/);
    });
  });

  describe('Lock #31: StoryPanelV2 split layout — leftSlot width = 440 (2026-05-22)', () => {
    // Story Mode v2 splits the canvas into a fixed-width left narrative pane
    // (440px) and a flex right blueprint pane. If anyone reduces or removes
    // the 440 width, the 5-zone left pane reflows + the blueprint pane no
    // longer dominates the visual hierarchy. Lock prevents accidental drift.
    const src = read(
      'components/service-hub/estimate-studio/scope/StoryPanelV2.tsx',
    );

    it('declares leftSlot width = 440', () => {
      expect(src).toMatch(/leftSlot:\s*\{\s*width:\s*440/);
    });

    it('declares rightSlot as flex: 1', () => {
      expect(src).toMatch(/rightSlot:\s*\{\s*flex:\s*1/);
    });

    it('renders the chapter strip below the split, not inside it', () => {
      // The split View must close BEFORE the <ChapterStrip> mount.
      const splitClose = src.indexOf('</View>\n        <ChapterStrip');
      expect(splitClose).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Lock #32: ChapterLeftPane invisible scrollbar (premium aesthetic, 2026-05-22)', () => {
    // The narrative left pane scrolls vertically but MUST NOT show a browser
    // scrollbar — the Estimate Studio aesthetic requires no scrollbar chrome
    // visible inside the canvas. If this lock fails, someone removed the
    // web-only invisible-scrollbar style.
    const src = read(
      'components/service-hub/estimate-studio/scope/ChapterLeftPane.tsx',
    );

    it('applies scrollbarWidth: none (Firefox + modern Chromium)', () => {
      expect(src).toMatch(/scrollbarWidth:\s*['"]none['"]/);
    });

    it('applies msOverflowStyle: none (IE/legacy Edge)', () => {
      expect(src).toMatch(/msOverflowStyle:\s*['"]none['"]/);
    });

    it('platform-guards the invisible-scrollbar style for web only', () => {
      // The style must be gated behind Platform.OS === 'web' so native
      // doesn't try to apply a CSS-only property.
      expect(src).toMatch(/Platform\.OS\s*===\s*['"]web['"]/);
    });
  });
});
