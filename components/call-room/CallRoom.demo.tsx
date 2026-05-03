// components/call-room/CallRoom.demo.tsx
//
// Dev preview shell. EVERYTHING in the side panel is dev-only — end users
// will never see any of it. The "Preview as End User" toggle hides the
// entire panel so you can see the pure immersive Call Room as it ships.
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { CallRoom } from './CallRoom';
import { callRoomFixtures } from './fixtures/callRoomFixtures';
import type { TimeOfDayState } from './types';

const TIMES: TimeOfDayState[] = ['dawn', 'day', 'dusk', 'night'];

export default function CallRoomDemo(): React.ReactElement {
  // Default to fixture 1 ("Carl Diaz · default_male") so the 3D cartoon avatar
  // is visible on first load. Use the dev panel to switch fixtures.
  const [fixtureIdx, setFixtureIdx] = useState(1);
  const [forcedTime, setForcedTime] = useState<TimeOfDayState | 'auto'>('auto');
  const [parallaxScale, setParallaxScale] = useState(1);
  const [voiceSim, setVoiceSim] = useState<'silence' | 'caller' | 'host'>('silence');
  const [visible, setVisible] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  const fixture = callRoomFixtures[fixtureIdx];

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#000' }}>
      {panelOpen && (
        <ScrollView
          style={{ width: 280, backgroundColor: '#0e0e10', padding: 16, borderRightWidth: 1, borderRightColor: '#222' }}
          testID="call-room-dev-controls"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Dev Controls</Text>
            <Pressable
              onPress={() => setPanelOpen(false)}
              style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#1f2937', borderRadius: 6 }}
              accessibilityLabel="Hide dev panel"
            >
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>Hide ›</Text>
            </Pressable>
          </View>
          <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 12, fontStyle: 'italic' }}>
            All controls below are dev-only. End users see only the immersive room + floating card.
          </Text>

          <Section label="Fixture">
            {callRoomFixtures.map((f, i) => (
              <RowBtn
                key={f.state.client.id}
                active={i === fixtureIdx}
                label={f.label}
                onPress={() => setFixtureIdx(i)}
              />
            ))}
          </Section>

          <Section label="Time of day">
            {(['auto', ...TIMES] as const).map((t) => (
              <RowBtn key={t} active={t === forcedTime} label={t} onPress={() => setForcedTime(t)} />
            ))}
          </Section>

          <Section label="Voice activity">
            {(['silence', 'caller', 'host'] as const).map((v) => (
              <RowBtn key={v} active={v === voiceSim} label={v} onPress={() => setVoiceSim(v)} />
            ))}
          </Section>

          <Section label="Parallax intensity">
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[0, 0.5, 1, 1.5, 2].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setParallaxScale(s)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: s === parallaxScale ? '#1e3a8a' : '#1f2937',
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>{s}×</Text>
                </Pressable>
              ))}
            </View>
          </Section>

          <Pressable
            onPress={() => setVisible((v) => !v)}
            style={{ marginTop: 16, padding: 12, backgroundColor: '#dc2626', borderRadius: 6 }}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: '600' }}>
              {visible ? 'Hide Call Room' : 'Show Call Room'}
            </Text>
          </Pressable>
        </ScrollView>
      )}

      <View style={{ flex: 1 }}>
        <CallRoom
          visible={visible}
          callState={fixture.state}
          forcedTimeOfDay={forcedTime === 'auto' ? undefined : forcedTime}
          voiceState={voiceSim}
        />

        {!panelOpen && (
          <Pressable
            onPress={() => setPanelOpen(true)}
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              zIndex: 1000,
              backgroundColor: 'rgba(15,18,24,0.85)',
              borderWidth: 1,
              borderColor: 'rgba(120,170,220,0.4)',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              ...(Platform.OS === 'web'
                ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as object)
                : {}),
            }}
            accessibilityLabel="Show dev panel"
          >
            <Text style={{ fontSize: 14 }}>≡</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500' }}>Dev controls</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: '#6b7280', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function RowBtn({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 10,
        marginVertical: 2,
        backgroundColor: active ? '#1e3a8a' : '#1f2937',
        borderRadius: 6,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}
