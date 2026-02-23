import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { Colors, Typography } from '@/constants/tokens';
import { useSidebarState } from '@/lib/uiStore';

const logoSource = require('../../assets/images/aspire-logo-new.png');
const iconSource = require('../../assets/images/aspire-icon-new.png');

type SubItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

type NavItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  route: string;
  isExternal?: boolean;
  subItems?: SubItem[];
};

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home', route: '/(tabs)', isExternal: true },
  { id: 'overview', label: 'Overview', icon: 'analytics-outline', iconActive: 'analytics', route: '/finance-hub' },
  { id: 'cash', label: 'Cash', icon: 'wallet-outline', iconActive: 'wallet', route: '/finance-hub/cash' },
  { id: 'books', label: 'Books', icon: 'book-outline', iconActive: 'book', route: '/finance-hub/books' },
  {
    id: 'payroll',
    label: 'Payroll',
    icon: 'people-outline',
    iconActive: 'people',
    route: '/finance-hub/payroll',
    subItems: [
      { id: 'payroll-run', label: 'Run Payroll', icon: 'play-circle-outline', route: '/finance-hub/payroll' },
      { id: 'payroll-people', label: 'People', icon: 'people-outline', route: '/finance-hub/payroll/people' },
      { id: 'payroll-contractors', label: 'Contractors', icon: 'briefcase-outline', route: '/finance-hub/payroll/contractors' },
      { id: 'payroll-timeoff', label: 'Time Off', icon: 'calendar-outline', route: '/finance-hub/payroll/time-off' },
      { id: 'payroll-tax', label: 'Tax & Compliance', icon: 'shield-checkmark-outline', route: '/finance-hub/payroll/tax-compliance' },
      { id: 'payroll-history', label: 'Pay History', icon: 'time-outline', route: '/finance-hub/payroll/pay-history' },
      { id: 'payroll-settings', label: 'Settings', icon: 'settings-outline', route: '/finance-hub/payroll/settings' },
    ],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: 'document-text-outline',
    iconActive: 'document-text',
    route: '/finance-hub/invoices',
    subItems: [
      { id: 'invoices-list', label: 'All Invoices', icon: 'document-text-outline', route: '/finance-hub/invoices' },
      { id: 'invoices-quotes', label: 'Quotes', icon: 'pricetag-outline', route: '/finance-hub/quotes' },
      { id: 'invoices-clients', label: 'Clients', icon: 'people-outline', route: '/finance-hub/clients' },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: 'folder-outline',
    iconActive: 'folder',
    route: '/finance-hub/documents',
    subItems: [
      { id: 'docs-all', label: 'All Documents', icon: 'documents-outline', route: '/finance-hub/documents' },
      { id: 'docs-templates', label: 'Templates', icon: 'copy-outline', route: '/finance-hub/documents/templates' },
      { id: 'docs-pending', label: 'Awaiting Signature', icon: 'create-outline', route: '/finance-hub/documents/pending' },
    ],
  },
  { id: 'connections', label: 'Connections', icon: 'link-outline', iconActive: 'link', route: '/finance-hub/connections' },
  { id: 'receipts', label: 'Receipts', icon: 'receipt-outline', iconActive: 'receipt', route: '/finance-hub/receipts' },
];

const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 64;

export function FinanceSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { sidebarExpanded, toggleSidebar } = useSidebarState();
  const expanded = sidebarExpanded;
  const widthAnim = useRef(new Animated.Value(expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED)).current;
  const opacityAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  const isOnPayrollPage = pathname.startsWith('/finance-hub/payroll');
  const isOnInvoicesPage = pathname === '/finance-hub/invoices' || pathname.startsWith('/finance-hub/quotes') || pathname.startsWith('/finance-hub/clients');
  const isOnDocumentsPage = pathname.startsWith('/finance-hub/documents');
  const [payrollExpanded, setPayrollExpanded] = useState(isOnPayrollPage);
  const [invoicesExpanded, setInvoicesExpanded] = useState(isOnInvoicesPage);
  const [documentsExpanded, setDocumentsExpanded] = useState(isOnDocumentsPage);

  useEffect(() => {
    if (isOnPayrollPage) setPayrollExpanded(true);
  }, [isOnPayrollPage]);

  useEffect(() => {
    if (isOnInvoicesPage) setInvoicesExpanded(true);
  }, [isOnInvoicesPage]);

  useEffect(() => {
    if (isOnDocumentsPage) setDocumentsExpanded(true);
  }, [isOnDocumentsPage]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(widthAnim, {
        toValue: expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: expanded ? 1 : 0,
        duration: expanded ? 200 : 100,
        useNativeDriver: false,
      }),
    ]).start();
  }, [expanded]);

  const isActive = (item: NavItem) => {
    if (item.isExternal) return false;
    if (item.route === '/finance-hub') {
      return pathname === '/finance-hub' || pathname === '/finance-hub/';
    }
    if (item.id === 'payroll') {
      return pathname.startsWith('/finance-hub/payroll');
    }
    if (item.id === 'invoices') {
      return pathname === '/finance-hub/invoices' || pathname.startsWith('/finance-hub/quotes') || pathname.startsWith('/finance-hub/clients');
    }
    if (item.id === 'documents') {
      return pathname.startsWith('/finance-hub/documents');
    }
    return pathname.startsWith(item.route);
  };

  const isSubItemActive = (sub: SubItem) => {
    if (sub.route === '/finance-hub/payroll') {
      return pathname === '/finance-hub/payroll' || pathname === '/finance-hub/payroll/';
    }
    if (sub.route === '/finance-hub/invoices') {
      return pathname === '/finance-hub/invoices' || pathname === '/finance-hub/invoices/';
    }
    if (sub.route === '/finance-hub/documents') {
      return pathname === '/finance-hub/documents' || pathname === '/finance-hub/documents/';
    }
    return pathname === sub.route || pathname === sub.route + '/';
  };

  const webStyle = Platform.OS === 'web' ? {
    transition: 'width 200ms ease-out',
    width: expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
  } : {};

  return (
    <Animated.View style={[styles.container, Platform.OS !== 'web' && { width: widthAnim }, webStyle as any]}>
      <View style={[styles.logoSection, !expanded && styles.logoSectionCollapsed]}>
        <Pressable 
          style={styles.logoContainer}
          onHoverIn={() => setIsLogoHovered(true)}
          onHoverOut={() => setIsLogoHovered(false)}
          onPress={expanded ? undefined : toggleSidebar}
        >
          {expanded ? (
            <View style={styles.expandedLogoRow}>
              <Image 
                source={logoSource}
                style={styles.logoImageFull}
                resizeMode="contain"
              />
              <Pressable
                style={[
                  styles.collapseToggle,
                  { opacity: isLogoHovered ? 1 : 0 } as any
                ]}
                onPress={toggleSidebar}
              >
                <Ionicons name="chevron-back" size={14} color="rgba(255, 255, 255, 0.7)" />
              </Pressable>
            </View>
          ) : (
            <Pressable 
              style={[styles.collapsedLogoContainer, isLogoHovered && styles.collapsedLogoHovered]}
              onPress={toggleSidebar}
            >
              <View style={styles.logoIconWrapper}>
                <Image 
                  source={iconSource}
                  style={styles.logoIcon}
                  resizeMode="contain"
                />
              </View>
              {isLogoHovered && (
                <View style={styles.expandChevronBadge}>
                  <Ionicons name="chevron-forward" size={10} color="#fff" />
                </View>
              )}
            </Pressable>
          )}
        </Pressable>
      </View>

      <View style={[styles.navList, !expanded && styles.navListCollapsed]}>
        {navItems.map((item, index) => {
          const active = isActive(item);
          const isHome = item.id === 'home';
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const webProps = Platform.OS === 'web' && !expanded ? { title: item.label } : {};
          
          return (
            <React.Fragment key={item.id}>
              {isHome && expanded && (
                <View style={styles.dividerAfterHome} />
              )}
              {index === 1 && expanded && (
                <Text style={styles.sectionLabel}>Finance Hub</Text>
              )}
              <Pressable
                style={({ hovered, pressed }: any) => [
                  styles.navItem,
                  expanded && active && styles.navItemActive,
                  !expanded && styles.navItemCollapsed,
                  !expanded && active && styles.navItemCollapsedActive,
                  expanded && !active && hovered && styles.navItemHover,
                  !expanded && hovered && styles.navItemCollapsedHover,
                  pressed && styles.navItemPressed,
                ]}
                onPress={() => {
                  router.push(item.route as any);
                  if (hasSubItems && expanded) {
                    if (item.id === 'payroll') setPayrollExpanded(prev => !prev);
                    else if (item.id === 'invoices') setInvoicesExpanded(prev => !prev);
                    else if (item.id === 'documents') setDocumentsExpanded(prev => !prev);
                  }
                }}
                {...webProps}
              >
                {expanded ? (
                  <View style={[styles.iconContainer, active && styles.iconContainerActive]}>
                    <Ionicons
                      name={active ? item.iconActive : item.icon}
                      size={20}
                      color={active ? Colors.accent.cyan : Colors.text.secondary}
                    />
                  </View>
                ) : (
                  <View style={styles.collapsedIconContainer}>
                    <Ionicons
                      name={active ? item.iconActive : item.icon}
                      size={22}
                      color={active ? Colors.accent.cyan : Colors.text.secondary}
                    />
                  </View>
                )}
                {Platform.OS === 'web' ? (
                  <Text 
                    style={[
                      styles.navLabel, 
                      active && styles.navLabelActive,
                      { 
                        opacity: expanded ? 1 : 0,
                        width: expanded ? 'auto' : 0,
                        overflow: 'hidden',
                        transition: 'opacity 200ms ease-out, width 200ms ease-out',
                      } as any
                    ]}
                  >
                    {item.label}
                  </Text>
                ) : (
                  <Animated.Text 
                    style={[
                      styles.navLabel, 
                      active && styles.navLabelActive,
                      { opacity: opacityAnim }
                    ]}
                    numberOfLines={1}
                  >
                    {expanded ? item.label : ''}
                  </Animated.Text>
                )}
                {hasSubItems && expanded && (
                  <Pressable
                    style={styles.chevronBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (item.id === 'payroll') setPayrollExpanded(prev => !prev);
                      else if (item.id === 'invoices') setInvoicesExpanded(prev => !prev);
                      else if (item.id === 'documents') setDocumentsExpanded(prev => !prev);
                    }}
                  >
                    <Ionicons
                      name={(item.id === 'payroll' ? payrollExpanded : item.id === 'invoices' ? invoicesExpanded : item.id === 'documents' ? documentsExpanded : false) ? 'chevron-down' : 'chevron-forward'}
                      size={14}
                      color={Colors.text.muted}
                    />
                  </Pressable>
                )}
                {active && expanded && !hasSubItems && <View style={styles.activeIndicator} />}
                {active && expanded && hasSubItems && <View style={styles.activeIndicator} />}
              </Pressable>

              {hasSubItems && expanded && ((item.id === 'payroll' && payrollExpanded) || (item.id === 'invoices' && invoicesExpanded) || (item.id === 'documents' && documentsExpanded)) && (
                <View style={styles.subItemsContainer}>
                  {item.subItems!.map((sub) => {
                    const subActive = isSubItemActive(sub);
                    return (
                      <Pressable
                        key={sub.id}
                        style={({ hovered, pressed }: any) => [
                          styles.subItem,
                          subActive && styles.subItemActive,
                          !subActive && hovered && styles.subItemHover,
                          pressed && styles.subItemPressed,
                        ]}
                        onPress={() => router.push(sub.route as any)}
                      >
                        <Ionicons
                          name={sub.icon as any}
                          size={16}
                          color={subActive ? '#3B82F6' : Colors.text.muted}
                        />
                        <Text style={[
                          styles.subItemLabel,
                          subActive && styles.subItemLabelActive,
                        ]}>
                          {sub.label}
                        </Text>
                        {subActive && <View style={styles.subItemIndicator} />}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d0d0d',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
    paddingBottom: 12,
    height: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  logoSection: {
    paddingHorizontal: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  logoSectionCollapsed: {
    paddingHorizontal: 0,
    width: '100%',
  },
  logoContainer: {
    width: '100%',
  },
  expandedLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 4,
    height: 80,
  },
  logoImageFull: {
    height: 72,
    width: 180,
  },
  collapseToggle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      transition: 'opacity 150ms ease-out, background-color 150ms ease-out',
      cursor: 'pointer',
    } : {}),
  } as any,
  collapsedLogoContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 10,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 150ms ease-out',
    } : {}),
  } as any,
  collapsedLogoHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  logoIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoIcon: {
    width: 44,
    height: 44,
  },
  expandChevronBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  dividerAfterHome: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginVertical: 8,
    marginHorizontal: 8,
  },
  navList: {
    flex: 1,
    gap: 2,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  navListCollapsed: {
    alignItems: 'center',
    paddingHorizontal: 0,
    width: '100%',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    position: 'relative',
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.15s ease-out',
      cursor: 'pointer',
    } : {}),
  } as any,
  navItemActive: {
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  navItemHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  navItemPressed: {
    backgroundColor: '#0a0a0c',
  },
  navItemCollapsed: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    width: 48,
    height: 48,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    borderRadius: 10,
    gap: 0,
  },
  navItemCollapsedActive: {
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  navItemCollapsedHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  collapsedIconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: 'transparent',
  },
  navLabel: {
    ...Typography.bodyMedium,
    color: Colors.text.secondary,
    flex: 1,
    fontSize: 14,
  },
  navLabelActive: {
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -10,
    width: 3,
    height: 20,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 2,
  },
  chevronBtn: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  } as any,
  subItemsContainer: {
    marginLeft: 0,
    marginBottom: 4,
    gap: 1,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingLeft: 44,
    paddingRight: 8,
    borderRadius: 6,
    position: 'relative',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.15s ease-out',
    } : {}),
  } as any,
  subItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  subItemHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  subItemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  subItemLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  subItemLabelActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  subItemIndicator: {
    position: 'absolute',
    left: 34,
    top: '50%',
    marginTop: -6,
    width: 2,
    height: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 1,
  },
});
