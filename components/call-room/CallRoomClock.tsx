// components/call-room/CallRoomClock.tsx
//
// Premium clock for the top-left of the Call Room card. Shows the
// agent's local time (via browser-detected timezone), the date, and the
// IANA timezone abbreviation. Updates every minute (no second-precision —
// reduces re-renders, looks calmer).
//
// Design tokens match the card's glass material:
//   • Time:  16px, tabular-nums, white-90% — primary glance value
//   • Sub:   10.5px, white-50%, uppercase letterspaced — supportive
//   • Background: subtle glass pill (recessed top, soft drop shadow)
//
// Locale-correct formatting via Intl.DateTimeFormat — handles AM/PM vs
// 24h, weekday names, and timezone abbreviations per the user's locale.
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

const isWeb = Platform.OS === 'web';

interface ClockReading {
  time: string;
  meridiem: string;
  dateLine: string;
  tzAbbr: string;
}

function readClock(): ClockReading {
  const now = new Date();

  // Time + AM/PM split — split so we can de-emphasize the meridiem.
  const timeRaw = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now);
  // "2:18 PM" -> ["2:18", "PM"]
  const m = /^(\d{1,2}:\d{2})\s*(AM|PM)?$/i.exec(timeRaw);
  const time = m?.[1] ?? timeRaw;
  const meridiem = (m?.[2] ?? '').toUpperCase();

  // Date line — "Sun, May 3"
  const dateLine = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(now);

  // IANA TZ abbreviation — e.g., "EST", "PST", "GMT". Falls back to the
  // numeric offset string if the locale doesn't return a name.
  let tzAbbr = '';
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: 'short',
    }).formatToParts(now);
    tzAbbr = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    tzAbbr = '';
  }

  return { time, meridiem, dateLine, tzAbbr };
}

export function CallRoomClock(): React.ReactElement {
  const [reading, setReading] = useState<ClockReading>(() => readClock());

  useEffect(() => {
    // Tick on the next minute boundary, then every minute after that.
    // Aligning the first tick to the boundary avoids drift between the
    // clock and the wall-clock minute change.
    const now = new Date();
    const msToNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const boundary = setTimeout(() => {
      setReading(readClock());
      intervalId = setInterval(() => setReading(readClock()), 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(boundary);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <View style={styles.wrap} testID="call-room-clock" accessibilityRole="text">
      <View style={styles.timeRow}>
        <Text style={styles.time}>{reading.time}</Text>
        {reading.meridiem ? <Text style={styles.meridiem}>{reading.meridiem}</Text> : null}
      </View>
      <Text style={styles.subline} numberOfLines={1}>
        {reading.dateLine}
        {reading.tzAbbr ? <Text style={styles.tz}>{`  ${reading.tzAbbr}`}</Text> : null}
      </Text>
    </View>
  );
}

// Optional dot separator helper — currently inline above. Reserved for
// future variants where time + meridiem render on a single line.

const styles = StyleSheet.create({
  // Transparent wrap — clock sits naturally on the panel's glass background.
  // No fill, no border, no shadow; pure typography.
  wrap: {
    alignItems: 'flex-end',
  },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  time: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  meridiem: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  subline: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    marginTop: 1,
    letterSpacing: 0.3,
    textAlign: 'right',
  },
  tz: {
    color: 'rgba(150,195,235,0.7)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
