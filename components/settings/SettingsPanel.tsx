/**
 * SettingsPanel — Full-height sliding overlay panel for account settings.
 * Slides in from the right edge over the current page content.
 * Contains a left sidebar for section navigation and a scrollable content area.
 *
 * Controlled via `visible` + `onClose` props from DesktopHeader.
 * The `initialSection` prop allows deep-linking to a specific section from the profile menu.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SettingsColors, SettingsLayout, TRANSITION_SMOOTH } from './settingsConstants';
import {
  AccountSection,
  BillingSection,
  SecuritySection,
  PreferencesSection,
  AppearanceSection,
  NotificationsSection,
  HelpSection,
  FeedbackSection,
} from './sections';

/* ------------------------------------------------------------------ */
/*  Section definition                                                 */
/* ------------------------------------------------------------------ */

export type SettingsSectionId =
  | 'account'
  | 'billing'
  | 'security'
  | 'preferences'
  | 'appearance'
  | 'notifications'
  | 'help'
  | 'feedback';

interface SectionDef {
  id: SettingsSectionId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  group: string;
  badge?: string;
}

const SECTIONS: SectionDef[] = [
  { id: 'account', label: 'Account', icon: 'person-circle-outline', group: 'Account' },
  { id: 'billing', label: 'Billing & Plans', icon: 'card-outline', group: 'Account', badge: 'Pro' },
  { id: 'security', label: 'Security', icon: 'shield-checkmark-outline', group: 'Account' },
  { id: 'preferences', label: 'Preferences', icon: 'options-outline', group: 'Settings' },
  { id: 'appearance', label: 'Appearance', icon: 'color-palette-outline', group: 'Settings' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications-outline', group: 'Settings' },
  { id: 'help', label: 'Help & Support', icon: 'help-circle-outline', group: 'More' },
  { id: 'feedback', label: 'Send Feedback', icon: 'chatbox-ellipses-outline', group: 'More' },
];

const SECTION_COMPONENTS: Record<SettingsSectionId, React.ComponentType> = {
  account: AccountSection,
  billing: BillingSection,
  security: SecuritySection,
  preferences: PreferencesSection,
  appearance: AppearanceSection,
  notifications: NotificationsSection,
  help: HelpSection,
  feedback: FeedbackSection,
};

/* ------------------------------------------------------------------ */
/*  CSS keyframes for web                                              */
/* ------------------------------------------------------------------ */

function injectSettingsKeyframes() {
  if (Platform.OS !== 'web') return;
  const id = 'aspire-settings-panel-keyframes';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    @keyframes settingsPanelSlideIn {
      from { transform: translateX(100%); opacity: 0.7; }
      to   { transform: translateX(0%);   opacity: 1; }
    }
    @keyframes settingsScrimFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes settingsContentFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0px); }
    }
    .settings-nav-item { transition: ${TRANSITION_SMOOTH}; }
    .settings-nav-item:hover { background-color: ${SettingsColors.navHover}; }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface SettingsPanelProps {
  visible: boolean;
  onClose: () => void;
  initialSection?: SettingsSectionId;
}

export function SettingsPanel({ visible, onClose, initialSection = 'account' }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(initialSection);
  const scrollRef = useRef<ScrollView>(null);

  // Animate on native (web uses CSS keyframes)
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    injectSettingsKeyframes();
  }, []);

  // Sync initialSection when the panel opens with a different target
  useEffect(() => {
    if (visible && initialSection) {
      setActiveSection(initialSection);
    }
  }, [visible, initialSection]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        damping: 28,
        stiffness: 300,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleSectionChange = useCallback((id: SettingsSectionId) => {
    setActiveSection(id);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Handle scrim click
  const handleScrimPress = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle Escape key
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  if (!visible) return null;

  const ActiveComponent = SECTION_COMPONENTS[activeSection];

  // Group sections for sidebar rendering
  let lastGroup = '';

  return (
    <View style={styles.overlay}>
      {/* Scrim / backdrop */}
      <Pressable style={styles.scrim} onPress={handleScrimPress} />

      {/* Panel */}
      <View style={styles.panel}>
        {/* Panel header */}
        <View style={styles.panelHeader}>
          <View style={styles.panelTitleRow}>
            <Ionicons name="settings-outline" size={18} color={SettingsColors.accent} />
            <Text style={styles.panelTitle}>Settings</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ hovered }: { hovered?: boolean }) => [
              styles.closeBtn,
              hovered && styles.closeBtnHover,
            ] as ViewStyle[]}
          >
            <Ionicons name="close" size={18} color="#a1a1a6" />
          </Pressable>
        </View>

        <View style={styles.panelBody}>
          {/* Sidebar navigation */}
          <View style={styles.sidebar}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SECTIONS.map((section) => {
                const showGroupLabel = section.group !== lastGroup;
                lastGroup = section.group;
                const isActive = section.id === activeSection;

                return (
                  <React.Fragment key={section.id}>
                    {showGroupLabel && (
                      <Text style={styles.navGroupLabel}>{section.group}</Text>
                    )}
                    <Pressable
                      onPress={() => handleSectionChange(section.id)}
                      style={[
                        styles.navItem,
                        isActive && styles.navItemActive,
                      ]}
                      {...(Platform.OS === 'web' ? { className: 'settings-nav-item' } as Record<string, unknown> : {})}
                    >
                      <View style={styles.navItemLeft}>
                        <Ionicons
                          name={section.icon}
                          size={17}
                          color={isActive ? SettingsColors.accent : '#6e6e73'}
                        />
                        <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                          {section.label}
                        </Text>
                      </View>
                      {section.badge && (
                        <View style={styles.navBadge}>
                          <Text style={styles.navBadgeText}>{section.badge}</Text>
                        </View>
                      )}
                      {isActive && <View style={styles.navActiveIndicator} />}
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </ScrollView>

            {/* Sidebar footer with keyboard hint */}
            <View style={styles.sidebarFooter}>
              <View style={styles.kbdHint}>
                <View style={styles.kbd}><Text style={styles.kbdText}>Esc</Text></View>
                <Text style={styles.kbdLabel}>to close</Text>
              </View>
            </View>
          </View>

          {/* Content area */}
          <View style={styles.contentArea}>
            <ScrollView
              ref={scrollRef}
              style={styles.contentScroll}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
            >
              <ActiveComponent />
              <View style={styles.contentSpacer} />
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const WEB_SLIDE_IN = Platform.OS === 'web'
  ? { animation: 'settingsPanelSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }
  : {};

const WEB_SCRIM_FADE = Platform.OS === 'web'
  ? { animation: 'settingsScrimFadeIn 0.25s ease-out forwards' }
  : {};

const WEB_CONTENT_FADE = Platform.OS === 'web'
  ? { animation: 'settingsContentFadeIn 0.35s ease-out 0.1s forwards', opacity: 0 }
  : {};

const styles = StyleSheet.create({
  overlay: {
    ...(Platform.OS === 'web'
      ? { position: 'fixed' as unknown as 'absolute', top: 0, left: 0, right: 0, bottom: 0 }
      : StyleSheet.absoluteFillObject),
    zIndex: 9999,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  } as ViewStyle,

  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SettingsColors.scrim,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(4px)' } : {}),
    ...WEB_SCRIM_FADE,
  } as ViewStyle,

  panel: {
    width: SettingsLayout.panelWidth,
    maxWidth: '92%' as unknown as number,
    height: '100%',
    backgroundColor: SettingsColors.canvas,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
          ...WEB_SLIDE_IN,
        }
      : {}),
  } as ViewStyle,

  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f2f2f2',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  closeBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  panelBody: {
    flex: 1,
    flexDirection: 'row',
  },

  /* Sidebar */
  sidebar: {
    width: SettingsLayout.sidebarWidth,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.04)',
    paddingTop: 16,
    justifyContent: 'space-between',
  },
  navGroupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#48484a',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginHorizontal: 8,
    marginVertical: 1,
    borderRadius: 8,
    position: 'relative',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  } as ViewStyle,
  navItemActive: {
    backgroundColor: SettingsColors.navActive,
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#a1a1a6',
  },
  navLabelActive: {
    color: SettingsColors.accent,
    fontWeight: '600',
  },
  navBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: SettingsColors.accentBg,
  },
  navBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: SettingsColors.accent,
  },
  navActiveIndicator: {
    position: 'absolute',
    left: 0,
    top: '25%' as unknown as number,
    width: 3,
    height: '50%' as unknown as number,
    borderRadius: 1.5,
    backgroundColor: SettingsColors.accent,
  },

  sidebarFooter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  kbdHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kbd: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  kbdText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6e6e73',
  },
  kbdLabel: {
    fontSize: 11,
    color: '#48484a',
  },

  /* Content */
  contentArea: {
    flex: 1,
    ...WEB_CONTENT_FADE,
  } as ViewStyle,
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: SettingsLayout.contentPadding,
  },
  contentSpacer: {
    height: 40,
  },
});
