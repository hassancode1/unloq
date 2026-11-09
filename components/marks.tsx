// Shared pieces for showing what someone learned: the glass "coin" that holds
// a path's mark, the score ring, and the hook that finds a quest's mark.
// Used by Today, Stats and Quest detail so they always match.
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { usePathStyles, type PathStyle } from '../lib/pathColors';
import type { QuestEntry } from '../lib/quests';
import { SIGIL_DUOS, duoForSeed } from '../lib/sigil';
import { usePathCatalog } from '../lib/usePaths';
import { F } from './onboarding/ui';

/**
 * A little glass coin for a path mark: soft drop shadow, lighter at the top,
 * a faint highlight on the upper edge — depth instead of a flat disc.
 */
export function Coin({ size, ring, children }: { size: number; ring?: boolean; children?: React.ReactNode }) {
  return (
    <View style={[s.coinShadow, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={['#2B2A37', '#1A1923', '#101017']}
        locations={[0, 0.5, 1]}
        style={[s.coin, { borderRadius: size / 2, borderColor: ring ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.11)' }]}
      >
        {/* top-edge highlight */}
        <View pointerEvents="none" style={[s.coinShine, { borderRadius: size / 2 }]} />
        {children}
      </LinearGradient>
    </View>
  );
}

/** The score as a ring that fills to it. */
export function ScoreRing({ score, color, track, text, size = 54 }: {
  score: number; color: string; track: string; text: string; size?: number;
}) {
  const sw = Math.max(3, size / 13), r = (size - sw) / 2, c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={sw} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ color: text, fontFamily: F.black, fontSize: size * 0.3 }}>{score}</Text>
    </View>
  );
}

/** Returns lookFor(entry): the quest's path mark, or a stable one from its topic. */
export function useEntryLook() {
  const styleFor = usePathStyles();
  const { byId } = usePathCatalog();
  return (e: QuestEntry | undefined | null): PathStyle | null => {
    if (!e) return null;
    // the mark saved when it was learned wins: it never changes, even offline
    if (e.look) return { sigil: e.look.sigil, duo: e.look.duo, accent: e.look.duo[0] };
    const path = e.pathId ? byId.get(e.pathId) : undefined;
    if (path) return styleFor(path);
    // older quests while paths haven't loaded: stable per path, not per topic
    const seed = e.pathId ?? e.questId;
    const duo = SIGIL_DUOS[duoForSeed(seed)];
    return { sigil: seed, duo, accent: duo[0] };
  };
}

const s = StyleSheet.create({
  coinShadow: {
    backgroundColor: '#0C0B12',
    shadowColor: '#000', shadowOpacity: 0.9, shadowRadius: 9, shadowOffset: { width: 0, height: 5 },
  },
  coin: { flex: 1, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coinShine: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
});
