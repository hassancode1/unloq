// Dev playground for Glim. Toggle via GLIM_LAB in App.tsx.
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Glim, { GLIM_STAGES, GlimHandle, GlimMood, GlimStage } from '../components/mascot/Glim';
import { INTEREST_PALETTES, paletteForInterests } from '../components/mascot/palettes';

const MOODS: GlimMood[] = ['idle', 'sleepy', 'happy'];

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function GlimLab() {
  const insets = useSafeAreaInsets();
  const glim = useRef<GlimHandle>(null);
  const [stage, setStage] = useState<GlimStage>(0);
  const [mood, setMood] = useState<GlimMood>('idle');
  const [droop, setDroop] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);

  const toggleInterest = (k: string) => {
    setInterests((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
    glim.current?.absorb();
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <Text style={s.title}>Glim · {GLIM_STAGES[stage].name}</Text>
      <View style={s.stageArea}>
        <Glim ref={glim} size={260} stage={stage} mood={mood} droop={droop} palette={paletteForInterests(interests)} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 14 }}>
        <Text style={s.label}>Stage</Text>
        <View style={s.row}>
          {GLIM_STAGES.map((st, i) => (
            <Chip key={st.name} label={st.name} active={stage === i} onPress={() => setStage(i as GlimStage)} />
          ))}
        </View>

        <Text style={s.label}>Mood</Text>
        <View style={s.row}>
          {MOODS.map((m) => <Chip key={m} label={m} active={mood === m} onPress={() => setMood(m)} />)}
        </View>

        <Text style={s.label}>Brain rot (droop) {Math.round(droop * 100)}%</Text>
        <View style={s.row}>
          {[0, 0.25, 0.5, 0.75, 1].map((d) => (
            <Chip key={d} label={`${d * 100}`} active={droop === d} onPress={() => setDroop(d)} />
          ))}
        </View>

        <Text style={s.label}>Reactions</Text>
        <View style={s.row}>
          <Chip label="poke" onPress={() => glim.current?.poke()} />
          <Chip label="happy" onPress={() => glim.current?.happy()} />
          <Chip label="nod" onPress={() => glim.current?.nod()} />
          <Chip label="no" onPress={() => glim.current?.no()} />
          <Chip label="jump" onPress={() => glim.current?.jump()} />
          <Chip label="absorb" onPress={() => glim.current?.absorb()} />
        </View>

        <Text style={s.label}>Interests → colour</Text>
        <View style={s.row}>
          {Object.keys(INTEREST_PALETTES).map((k) => (
            <Chip key={k} label={k} active={interests.includes(k)} onPress={() => toggleInterest(k)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07060B', paddingHorizontal: 16 },
  title: { color: '#fff', fontFamily: 'Nunito-ExtraBold', fontSize: 20, textAlign: 'center' },
  stageArea: { alignItems: 'center', justifyContent: 'center', height: 320 },
  label: { color: '#8B8A99', fontFamily: 'Nunito-Bold', fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#17151F' },
  chipActive: { backgroundColor: '#fff' },
  chipText: { color: '#D4D3DE', fontFamily: 'Nunito-SemiBold', fontSize: 13 },
  chipTextActive: { color: '#07060B' },
});
