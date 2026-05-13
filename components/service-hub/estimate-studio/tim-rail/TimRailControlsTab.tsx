/**
 * TimRailControlsTab — the rail-side home for the Estimate Studio's
 * chrome (address/search bar + studio tabs + quick actions).
 *
 * Why this exists:
 *   On laptops + tablets (768 ≤ width < 1280), the canvas-level chrome
 *   (header + slot + tab bar) eats the vertical space the hero/photos
 *   need to breathe. We hoist that chrome INTO the Tim rail's third
 *   tab so the canvas becomes pure visual content — hero + lane only.
 *
 *   On desktop (≥ 1280), the canvas-level chrome stays in place and
 *   this tab renders only QUICK ACTIONS so it doesn't duplicate the
 *   in-canvas affordances.
 *
 * Aspire Laws:
 *   - #1 Single Brain: this is a render layer. Tapping a studio tab
 *     calls `router.push(...)` — no autonomous routing decisions.
 *   - #7 Tools Are Hands: Upload + New Project handlers come from a
 *     shared hook (`useEstimateStudioActions`) so both this tab and
 *     `ProjectAddressBar` invoke identical logic.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import { ProjectAddressBar } from '../ProjectAddressBar';
import { MaterialsSlotBar } from '../materials/MaterialsSlotBar';
import { useEstimateStudioActions } from '@/hooks/useEstimateStudioActions';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// Studio tab list — mirrors `EstimateStudioTabBar.tsx`. Kept in sync via
// the regression test in __tests__/visuals/.
const STUDIO_TABS: { id: string; label: string; icon: IoniconsName; route: Href }[] = [
  { id: 'visuals',       label: 'Visuals',         icon: 'image-outline',           route: '/service-hub/estimate-studio/visuals' as Href },
  { id: 'plans-photos',  label: 'Plans & Photos',  icon: 'document-attach-outline', route: '/service-hub/estimate-studio/plans-photos' as Href },
  { id: 'scope',         label: 'Scope',           icon: 'list-outline',            route: '/service-hub/estimate-studio/scope' as Href },
  { id: 'materials',     label: 'Materials',       icon: 'cube-outline',            route: '/service-hub/estimate-studio/materials' as Href },
  { id: 'takeoff',       label: 'Takeoff',         icon: 'grid-outline',            route: '/service-hub/estimate-studio/takeoff' as Href },
  { id: 'estimate',      label: 'Estimate',        icon: 'calculator-outline',      route: '/service-hub/estimate-studio/estimate' as Href },
];

// Desktop threshold — at this width and above, the in-canvas chrome is
// visible, so the Controls tab hides PROJECT + NAVIGATE sections to avoid
// duplicating affordances. Mirrors the LAPTOP_OR_TABLET_BREAKPOINT in
// EstimateStudioShell.
const DESKTOP_BREAKPOINT = 1280;

// One-shot scrollbar-hide stylesheet (web only). Mirrors the pattern in
// TimRailContextTab so the Controls tab scrolls without rendering a
// browser scrollbar inside the rail.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'tim-rail-controls-scrollbar-hide';
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      [data-tim-rail-controls="1"] { scrollbar-width: none; -ms-overflow-style: none; }
      [data-tim-rail-controls="1"]::-webkit-scrollbar { width: 0; height: 0; display: none; }
    `;
    document.head.appendChild(styleEl);
  }
}

export function TimRailControlsTab() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { onUpload, onNewProject } = useEstimateStudioActions();

  const isMaterialsTab =
    pathname.endsWith('/materials') || pathname.endsWith('/materials/');
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  // On desktop the in-canvas chrome is already visible — hide the
  // duplicate PROJECT and NAVIGATE sections; keep QUICK ACTIONS.
  const showChromeSections = !isDesktop;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="tim-rail-controls-tab"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      // RN-Web maps `dataSet` onto data-* attributes (data-tim-rail-controls).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...(Platform.OS === 'web' ? ({ dataSet: { timRailControls: '1' } } as any) : {})}
    >
      {showChromeSections && (
        <Section title="PROJECT" testID="tim-rail-controls-project">
          {isMaterialsTab ? <MaterialsSlotBar /> : <ProjectAddressBar />}
        </Section>
      )}

      {showChromeSections && (
        <Section title="NAVIGATE" testID="tim-rail-controls-navigate">
          <View style={styles.tabGrid}>
            {STUDIO_TABS.map((tab) => {
              const routeStr = String(tab.route);
              const isActive = pathname === routeStr || pathname === routeStr + '/';
              return (
                <StudioTabPill
                  key={tab.id}
                  label={tab.label}
                  icon={tab.icon}
                  isActive={isActive}
                  onPress={() => router.push(tab.route)}
                />
              );
            })}
          </View>
        </Section>
      )}

      <Section title="QUICK ACTIONS" testID="tim-rail-controls-actions">
        <View style={styles.actionsStack}>
          <SecondaryButton
            label="Upload"
            icon="cloud-upload-outline"
            onPress={onUpload}
            testID="tim-rail-controls-upload"
            accessibilityLabel="Upload project evidence"
          />
          <PrimaryButton
            label="New Project"
            icon="add-outline"
            onPress={onNewProject}
            testID="tim-rail-controls-new-project"
            accessibilityLabel="Start a new estimate project"
          />
        </View>
      </Section>
    </ScrollView>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
  testID,
}: {
  title: string;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

// ─── Studio tab pill (2-col grid) ────────────────────────────────────────────

function StudioTabPill({
  label,
  icon,
  isActive,
  onPress,
}: {
  label: string;
  icon: IoniconsName;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${label} tab`}
      accessibilityState={{ selected: isActive }}
      testID={`tim-rail-controls-tab-${label.toLowerCase().replace(/\s|&/g, '-')}`}
      style={({ hovered, pressed, focused }: any) => [
        styles.pill,
        isActive && styles.pillActive,
        !isActive && hovered && styles.pillHover,
        pressed && styles.pillPressed,
        focused && (styles.pillFocused as any),
      ]}
    >
      <Ionicons
        name={icon}
        size={13}
        color={isActive ? '#0A0A0F' : 'rgba(255,255,255,0.65)'}
      />
      <Text
        style={[styles.pillLabel, isActive && styles.pillLabelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

function SecondaryButton({
  label,
  icon,
  onPress,
  testID,
  accessibilityLabel,
}: {
  label: string;
  icon: IoniconsName;
  onPress: () => void;
  testID?: string;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ hovered, pressed, focused }: any) => [
        styles.button,
        styles.buttonSecondary,
        hovered && styles.buttonSecondaryHover,
        pressed && styles.buttonPressed,
        focused && (styles.buttonFocused as any),
      ]}
    >
      <Ionicons name={icon} size={15} color="rgba(255,255,255,0.85)" />
      <Text style={styles.buttonLabelSecondary}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({
  label,
  icon,
  onPress,
  testID,
  accessibilityLabel,
}: {
  label: string;
  icon: IoniconsName;
  onPress: () => void;
  testID?: string;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ hovered, pressed, focused }: any) => [
        styles.button,
        styles.buttonPrimary,
        hovered && styles.buttonPrimaryHover,
        pressed && styles.buttonPressed,
        focused && (styles.buttonFocusedPrimary as any),
      ]}
    >
      <Ionicons name={icon} size={15} color="#0A0A0F" />
      <Text style={styles.buttonLabelPrimary}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 12,
    gap: 14,
  },

  // Section ----------------------------------------------------------------
  section: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
  },
  sectionBody: {
    gap: 8,
  },

  // 2-col tab grid ---------------------------------------------------------
  tabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // 2 per row: (100% - 6px gap) / 2 — use flexBasis with grow to fill.
    flexBasis: '48%',
    flexGrow: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'transparent',
    minHeight: 32,
    ...(Platform.OS === 'web'
      ? (({
          transition: 'all 180ms ease',
          cursor: 'pointer',
        } as unknown) as ViewStyle)
      : {}),
  },
  pillActive: {
    backgroundColor: '#ffffff',
    ...(Platform.OS === 'web'
      ? (({
          backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        } as unknown) as ViewStyle)
      : {}),
  },
  pillHover: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pillPressed: {
    opacity: 0.85,
  },
  pillFocused: {
    outlineWidth: 2,
    outlineColor: '#fbbf24',
    outlineStyle: 'solid',
    outlineOffset: 2,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  pillLabelActive: {
    color: '#0A0A0F',
    fontWeight: '600',
  },

  // Buttons ----------------------------------------------------------------
  actionsStack: {
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44, // a11y tap target
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? (({
          transition: 'all 180ms ease',
          cursor: 'pointer',
        } as unknown) as ViewStyle)
      : {}),
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  buttonSecondaryHover: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  buttonPrimary: {
    backgroundColor: '#fbbf24',
    ...(Platform.OS === 'web'
      ? (({
          backgroundImage: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        } as unknown) as ViewStyle)
      : {}),
  },
  buttonPrimaryHover: {
    ...(Platform.OS === 'web'
      ? (({
          backgroundImage: 'linear-gradient(135deg, #fcd34d 0%, #fbbf24 100%)',
          boxShadow: '0 2px 6px rgba(251,191,36,0.30)',
        } as unknown) as ViewStyle)
      : {}),
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonFocused: {
    outlineWidth: 2,
    outlineColor: '#fbbf24',
    outlineStyle: 'solid',
    outlineOffset: 2,
  },
  buttonFocusedPrimary: {
    outlineWidth: 2,
    outlineColor: '#fcd34d',
    outlineStyle: 'solid',
    outlineOffset: 2,
  },
  buttonLabelSecondary: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  buttonLabelPrimary: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A0A0F',
    letterSpacing: -0.1,
  },
});
