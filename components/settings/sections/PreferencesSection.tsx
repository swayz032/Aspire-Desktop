/**
 * Preferences section.
 * Language, timezone, date format, and currency settings.
 * Values pre-populated from TenantProvider.
 * TODO: Wire to PATCH /api/suite-profile for persistence.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTenant } from '@/providers';
import { SectionHeader, SelectField, ToggleField, Divider } from '../SettingsField';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English (US)' },
  { value: 'en-gb', label: 'English (UK)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'ja', label: 'Japanese' },
];

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (EU)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
  { value: 'MMM DD, YYYY', label: 'Mar 15, 2026' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro' },
  { value: 'GBP', label: 'British Pound' },
  { value: 'CAD', label: 'Canadian Dollar (C$)' },
  { value: 'AUD', label: 'Australian Dollar (A$)' },
  { value: 'JPY', label: 'Japanese Yen' },
  { value: 'MXN', label: 'Mexican Peso (MXN)' },
];

const WEEK_START_OPTIONS = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'saturday', label: 'Saturday' },
];

export default function PreferencesSection() {
  const { tenant } = useTenant();

  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState(tenant?.timezone || 'America/New_York');
  const [dateFormat, setDateFormat] = useState('MMM DD, YYYY');
  const [currency, setCurrency] = useState(tenant?.currency || 'USD');
  const [weekStart, setWeekStart] = useState('sunday');
  const [use24Hour, setUse24Hour] = useState(false);
  const [showSeconds, setShowSeconds] = useState(false);
  const [numberFormat, setNumberFormat] = useState('comma');

  return (
    <View>
      <SectionHeader
        title="Preferences"
        subtitle="Customize your regional and display preferences"
        icon="options-outline"
      />

      {/* Language & Region */}
      <Text style={styles.groupTitle}>Language & Region</Text>
      <SelectField
        label="Language"
        value={language}
        options={LANGUAGE_OPTIONS}
        onValueChange={setLanguage}
        hint="This affects the interface language only"
      />
      <SelectField
        label="Timezone"
        value={timezone}
        options={TIMEZONE_OPTIONS}
        onValueChange={setTimezone}
        hint="Used for scheduling, receipts, and activity timestamps"
      />
      <SelectField
        label="Currency"
        value={currency}
        options={CURRENCY_OPTIONS}
        onValueChange={setCurrency}
        hint="Default currency for invoices, estimates, and financial reports"
      />

      <Divider />

      {/* Date & Time */}
      <Text style={styles.groupTitle}>Date & Time</Text>
      <SelectField
        label="Date Format"
        value={dateFormat}
        options={DATE_FORMAT_OPTIONS}
        onValueChange={setDateFormat}
      />
      <SelectField
        label="Week Starts On"
        value={weekStart}
        options={WEEK_START_OPTIONS}
        onValueChange={setWeekStart}
      />
      <ToggleField
        label="24-Hour Time"
        description="Display times in 24-hour format (e.g. 14:30 instead of 2:30 PM)"
        value={use24Hour}
        onValueChange={setUse24Hour}
      />
      <ToggleField
        label="Show Seconds"
        description="Include seconds in timestamp displays"
        value={showSeconds}
        onValueChange={setShowSeconds}
      />

      <Divider />

      {/* Number Formatting */}
      <Text style={styles.groupTitle}>Number Formatting</Text>
      <SelectField
        label="Number Format"
        value={numberFormat}
        options={[
          { value: 'comma', label: '1,234.56 (US)' },
          { value: 'period', label: '1.234,56 (EU)' },
          { value: 'space', label: '1 234.56 (International)' },
        ]}
        onValueChange={setNumberFormat}
        hint="Affects how numbers are displayed in financial reports and dashboards"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d1d6',
    marginBottom: 16,
    letterSpacing: -0.1,
  },
});
