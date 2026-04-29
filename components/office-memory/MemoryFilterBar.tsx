/**
 * MemoryFilterBar — horizontal row of dropdown chips for the results page.
 *
 * Five chips: Type / Date / Entity / Tags / Sort. Each opens a popover-style
 * menu with options. Active chip glows with the Aspire blue ring + tinted bg
 * (Colors.accent.cyan + Colors.accent.cyanLight).
 *
 * The "search clear" chip below the row only renders when `filters.q` is set —
 * shows the live query text + an X to clear it.
 *
 * Web uses CSS-driven popovers (absolute-positioned panels). Native gets the
 * same panels rendered inline via Modal wrapping (kept minimal — the page is
 * desktop-first per plan §8).
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Typography } from '@/constants/tokens';
import {
  MEMORY_TYPE_COLORS,
  type MemoryFilters,
  type MemorySortKey,
  type MemoryType,
} from './types';

// ---------------------------------------------------------------------------
// Static option lists
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: { value: MemoryType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  ...(Object.keys(MEMORY_TYPE_COLORS) as MemoryType[]).map((t) => ({
    value: t,
    label: MEMORY_TYPE_COLORS[t].label,
  })),
];

type DateRange = NonNullable<MemoryFilters['dateRange']>;

const DATE_OPTIONS: { value: DateRange | 'all'; label: string }[] = [
  { value: 'all', label: 'Anytime' },
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'last_90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range…' },
];

const SORT_OPTIONS: { value: MemorySortKey; label: string }[] = [
  { value: 'recent', label: 'Most recent' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'relevance', label: 'Most relevant' },
];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MemoryFilterBarProps {
  filters: MemoryFilters;
  availableEntities?: { id: string; name: string }[];
  availableTags?: string[];
  onChange: (f: Partial<MemoryFilters>) => void;
}

type OpenMenu = 'type' | 'date' | 'entity' | 'tags' | 'sort' | null;

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

interface ChipProps {
  label: string;
  active: boolean;
  open: boolean;
  onPress: () => void;
  testID?: string;
}

function Chip({ label, active, open, onPress, testID }: ChipProps) {
  const [hover, setHover] = useState(false);
  const isHighlighted = active || open;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={[
        styles.chip,
        isHighlighted && styles.chipActive,
        hover && !isHighlighted && styles.chipHover,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text
        style={[
          styles.chipLabel,
          isHighlighted && styles.chipLabelActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Ionicons
        name={open ? 'chevron-up' : 'chevron-down'}
        size={13}
        color={isHighlighted ? (Colors.accent.cyan as string) : (Colors.text.tertiary as string)}
        style={styles.chipChevron}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Popover menu — anchors below the chip row
// ---------------------------------------------------------------------------

interface MenuOption<T> {
  value: T;
  label: string;
  selected?: boolean;
}

interface MenuProps<T> {
  options: MenuOption<T>[];
  onSelect: (v: T) => void;
  multi?: boolean;
  emptyLabel?: string;
}

function Menu<T extends string | number>({ options, onSelect, multi, emptyLabel }: MenuProps<T>) {
  if (options.length === 0) {
    return (
      <View style={styles.menu}>
        <Text style={styles.menuEmpty}>{emptyLabel ?? 'No options'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.menu}>
      <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
        {options.map((opt) => (
          <Pressable
            key={String(opt.value)}
            onPress={() => onSelect(opt.value)}
            style={({ hovered }: { hovered?: boolean }) => [
              styles.menuItem,
              hovered && styles.menuItemHover,
            ]}
            accessibilityRole="menuitem"
          >
            <Text style={[styles.menuItemLabel, opt.selected && styles.menuItemLabelSelected]}>
              {opt.label}
            </Text>
            {opt.selected ? (
              <Ionicons
                name={multi ? 'checkbox' : 'checkmark'}
                size={14}
                color={Colors.accent.cyan as string}
              />
            ) : multi ? (
              <View style={styles.menuItemCheckboxOff} />
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// MemoryFilterBar
// ---------------------------------------------------------------------------

export function MemoryFilterBar({
  filters,
  availableEntities = [],
  availableTags = [],
  onChange,
}: MemoryFilterBarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const toggle = (id: Exclude<OpenMenu, null>) =>
    setOpenMenu((cur) => (cur === id ? null : id));

  // -- chip labels reflect active filter state -----------------------------
  const typeLabel = useMemo(() => {
    if (!filters.type) return 'Type';
    return `Type: ${MEMORY_TYPE_COLORS[filters.type].label}`;
  }, [filters.type]);

  const dateLabel = useMemo(() => {
    const opt = DATE_OPTIONS.find((o) => o.value === filters.dateRange);
    if (!opt || opt.value === 'all') return 'Date';
    return `Date: ${opt.label}`;
  }, [filters.dateRange]);

  const entityLabel = useMemo(() => {
    if (!filters.entityId) return 'Entity';
    const found = availableEntities.find((e) => e.id === filters.entityId);
    return found ? `Entity: ${found.name}` : 'Entity';
  }, [filters.entityId, availableEntities]);

  const tagsLabel = useMemo(() => {
    const n = filters.tags?.length ?? 0;
    if (n === 0) return 'Tags';
    if (n === 1) return `Tags: ${filters.tags![0]}`;
    return `Tags: ${n} selected`;
  }, [filters.tags]);

  const sortLabel = useMemo(() => {
    const cur = filters.sort ?? 'recent';
    const opt = SORT_OPTIONS.find((o) => o.value === cur);
    return `Sort: ${opt?.label ?? 'Most recent'}`;
  }, [filters.sort]);

  const close = () => setOpenMenu(null);

  // -- handlers ------------------------------------------------------------
  const onSelectType = (v: MemoryType | 'all') => {
    onChange({ type: v === 'all' ? undefined : v, page: 1 });
    close();
  };

  const onSelectDate = (v: DateRange | 'all') => {
    onChange({ dateRange: v === 'all' ? undefined : v, page: 1 });
    close();
  };

  const onSelectEntity = (id: string | 'all') => {
    onChange({ entityId: id === 'all' ? undefined : id, page: 1 });
    close();
  };

  const onToggleTag = (tag: string) => {
    const cur = filters.tags ?? [];
    const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
    onChange({ tags: next.length === 0 ? undefined : next, page: 1 });
    // intentionally keep menu open for multiselect
  };

  const onSelectSort = (v: MemorySortKey) => {
    onChange({ sort: v, page: 1 });
    close();
  };

  const onClearSearch = () => onChange({ q: undefined, page: 1 });

  // -- option lists --------------------------------------------------------
  const typeOptions: MenuOption<MemoryType | 'all'>[] = TYPE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
    selected: o.value === 'all' ? !filters.type : filters.type === o.value,
  }));

  const dateOptions: MenuOption<DateRange | 'all'>[] = DATE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
    selected: o.value === 'all' ? !filters.dateRange : filters.dateRange === o.value,
  }));

  const entityOptions: MenuOption<string | 'all'>[] = [
    { value: 'all' as const, label: 'All entities', selected: !filters.entityId },
    ...availableEntities.map((e) => ({
      value: e.id,
      label: e.name,
      selected: filters.entityId === e.id,
    })),
  ];

  const tagOptions: MenuOption<string>[] = availableTags.map((t) => ({
    value: t,
    label: t,
    selected: (filters.tags ?? []).includes(t),
  }));

  const sortOptions: MenuOption<MemorySortKey>[] = SORT_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
    selected: (filters.sort ?? 'recent') === o.value,
  }));

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.chipWrap}>
          <Chip
            label={typeLabel}
            active={!!filters.type}
            open={openMenu === 'type'}
            onPress={() => toggle('type')}
            testID="filter-chip-type"
          />
          {openMenu === 'type' && (
            <Menu options={typeOptions} onSelect={onSelectType} />
          )}
        </View>

        <View style={styles.chipWrap}>
          <Chip
            label={dateLabel}
            active={!!filters.dateRange}
            open={openMenu === 'date'}
            onPress={() => toggle('date')}
            testID="filter-chip-date"
          />
          {openMenu === 'date' && (
            <Menu options={dateOptions} onSelect={onSelectDate} />
          )}
        </View>

        <View style={styles.chipWrap}>
          <Chip
            label={entityLabel}
            active={!!filters.entityId}
            open={openMenu === 'entity'}
            onPress={() => toggle('entity')}
            testID="filter-chip-entity"
          />
          {openMenu === 'entity' && (
            <Menu
              options={entityOptions}
              onSelect={onSelectEntity}
              emptyLabel="No entities yet"
            />
          )}
        </View>

        <View style={styles.chipWrap}>
          <Chip
            label={tagsLabel}
            active={(filters.tags?.length ?? 0) > 0}
            open={openMenu === 'tags'}
            onPress={() => toggle('tags')}
            testID="filter-chip-tags"
          />
          {openMenu === 'tags' && (
            <Menu
              options={tagOptions}
              onSelect={onToggleTag}
              multi
              emptyLabel="No tags yet"
            />
          )}
        </View>

        <View style={styles.chipWrap}>
          <Chip
            label={sortLabel}
            active={!!filters.sort && filters.sort !== 'recent'}
            open={openMenu === 'sort'}
            onPress={() => toggle('sort')}
            testID="filter-chip-sort"
          />
          {openMenu === 'sort' && (
            <Menu options={sortOptions} onSelect={onSelectSort} />
          )}
        </View>
      </View>

      {filters.q ? (
        <Pressable
          onPress={onClearSearch}
          style={({ hovered }: { hovered?: boolean }) => [
            styles.searchClearChip,
            hovered && styles.searchClearChipHover,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Clear search: ${filters.q}`}
          testID="filter-search-clear"
        >
          <Ionicons name="search" size={12} color={Colors.text.tertiary as string} />
          <Text style={styles.searchClearText} numberOfLines={1}>
            {filters.q}
          </Text>
          <Ionicons name="close" size={12} color={Colors.text.secondary as string} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    zIndex: 20,
    ...(Platform.OS === 'web' ? ({ position: 'relative' } as object) : {}),
  } as any,

  chipWrap: {
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ zIndex: 30 } as object) : {}),
  } as any,

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border.default as string,
    backgroundColor: 'rgba(255,255,255,0.02)',
    ...(Platform.OS === 'web'
      ? ({ transition: 'border-color 140ms ease-out, background-color 140ms ease-out' } as object)
      : {}),
  } as any,
  chipHover: {
    borderColor: Colors.border.strong as string,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: {
    borderColor: Colors.accent.cyan as string,
    backgroundColor: Colors.accent.cyanLight as string,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text.secondary as string,
    maxWidth: 220,
  },
  chipLabelActive: {
    color: Colors.accent.cyan as string,
    fontWeight: '600' as const,
  },
  chipChevron: {
    marginLeft: 2,
  },

  // popover menu
  menu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 6,
    minWidth: 220,
    maxWidth: 320,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: Colors.border.default as string,
    borderRadius: BorderRadius.lg,
    paddingVertical: 6,
    zIndex: 100,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 14px 36px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.45,
          shadowRadius: 24,
          elevation: 12,
        }),
  } as any,
  menuScroll: {
    maxHeight: 320,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 12,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
  } as any,
  menuItemHover: {
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  menuItemLabel: {
    fontSize: 13,
    color: Colors.text.secondary as string,
    fontWeight: '500' as const,
    flex: 1,
  },
  menuItemLabelSelected: {
    color: Colors.text.primary as string,
  },
  menuItemCheckboxOff: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border.strong as string,
  },
  menuEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.text.muted as string,
  },

  // search clear chip — the row beneath the filter chips
  searchClearChip: {
    alignSelf: 'flex-start',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
    backgroundColor: 'rgba(59,130,246,0.06)',
    maxWidth: 480,
    ...(Platform.OS === 'web'
      ? ({ transition: 'background-color 140ms ease-out' } as object)
      : {}),
  } as any,
  searchClearChipHover: {
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderColor: 'rgba(59,130,246,0.35)',
  },
  searchClearText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text.secondary as string,
    maxWidth: 360,
  },
});
