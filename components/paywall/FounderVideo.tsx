// The founder video on the paywall: muted autoplay loop, tap for sound.
// Loaded lazily from app/pro-gate.tsx (expo-video is a native module).
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { F } from '../onboarding/ui';

export default function FounderVideo({ source }: { source: number }) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <Pressable
        onPress={() => { player.muted = !muted; setMuted(!muted); Haptics.selectionAsync().catch(() => {}); }}
        hitSlop={10}
        style={s.sound}
        accessibilityLabel={muted ? 'Turn sound on' : 'Mute'}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#FFFFFF" />
        {muted && <Text style={s.soundText}>Tap for sound</Text>}
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  sound: {
    position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
  },
  soundText: { color: '#FFFFFF', fontFamily: F.semi, fontSize: 12 },
});
