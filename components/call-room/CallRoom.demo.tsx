// components/call-room/CallRoom.demo.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { CallRoom } from './CallRoom';
import { callRoomFixtures } from './fixtures/callRoomFixtures';
import type { TimeOfDayState } from './types';

const TIMES: TimeOfDayState[] = ['dawn', 'day', 'dusk', 'night'];

export default function CallRoomDemo(): React.ReactElement {
  const [fixtureIdx, setFixtureIdx] = useState(0);
  const [forcedTime, setForcedTime] = useState<TimeOfDayState | 'auto'>('auto');
  const [parallaxScale, setParallaxScale] = useState(1);
  const [voiceSim, setVoiceSim] = useState<'silence' | 'caller' | 'host'>('silence');
  const [visible, setVisible] = useState(true);

  const fixture = callRoomFixtures[fixtureIdx];

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#000' }}>
      <ScrollView
        style={{ width: 280, backgroundColor: '#111', padding: 16 }}
        testID="call-room-dev-controls"
      >
        <Text style={{ color: '#fff', fontSize: 18, marginBottom: 12 }}>Dev Controls</Text>

        <Text style={{ color: '#888', marginTop: 12 }}>Fixture</Text>
        {callRoomFixtures.map((f, i) => (
          <Pressable
            key={f.state.client.id}
            onPress={() => setFixtureIdx(i)}
            style={{
              padding: 8,
              marginVertical: 2,
              backgroundColor: i === fixtureIdx ? '#1e3a8a' : '#222',
              borderRadius: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>{f.label}</Text>
          </Pressable>
        ))}

        <Text style={{ color: '#888', marginTop: 12 }}>Time of day</Text>
        {(['auto', ...TIMES] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setForcedTime(t)}
            style={{
              padding: 8,
              marginVertical: 2,
              backgroundColor: t === forcedTime ? '#1e3a8a' : '#222',
              borderRadius: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>{t}</Text>
          </Pressable>
        ))}

        <Text style={{ color: '#888', marginTop: 12 }}>Voice activity</Text>
        {(['silence', 'caller', 'host'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setVoiceSim(v)}
            style={{
              padding: 8,
              marginVertical: 2,
              backgroundColor: v === voiceSim ? '#1e3a8a' : '#222',
              borderRadius: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>{v}</Text>
          </Pressable>
        ))}

        <Text style={{ color: '#888', marginTop: 12 }}>Parallax intensity</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 0.5, 1, 1.5, 2].map((s) => (
            <Pressable
              key={s}
              onPress={() => setParallaxScale(s)}
              style={{
                padding: 8,
                backgroundColor: s === parallaxScale ? '#1e3a8a' : '#222',
                borderRadius: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12 }}>{s}×</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setVisible((v) => !v)}
          style={{ marginTop: 16, padding: 12, backgroundColor: '#dc2626', borderRadius: 4 }}
        >
          <Text style={{ color: '#fff', textAlign: 'center' }}>
            {visible ? 'Hide Call Room' : 'Show Call Room'}
          </Text>
        </Pressable>
      </ScrollView>

      <View style={{ flex: 1 }}>
        <CallRoom
          visible={visible}
          callState={fixture.state}
          // dev-only props (will be wired in later milestones):
          // forcedTimeOfDay={forcedTime === 'auto' ? undefined : forcedTime}
          // parallaxScale={parallaxScale}
          // voiceSim={voiceSim}
        />
      </View>
    </View>
  );
}
