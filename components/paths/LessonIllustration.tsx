// The lesson's explainer illustration (curated paths, approved in Unloq Studio).
// Fades in once loaded; takes no space when there isn't one.
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { O } from '../onboarding/ui';

export default function LessonIllustration({ url }: { url?: string | null }) {
  const [loaded, setLoaded] = useState(false);
  if (!url) return null;
  return (
    <View style={st.frame}>
      <Image
        source={{ uri: url }}
        onLoad={() => setLoaded(true)}
        style={[st.img, { opacity: loaded ? 1 : 0 }]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const st = StyleSheet.create({
  // 1536×1024 artwork → 3:2
  frame: { aspectRatio: 1.5, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0B0A11', borderWidth: 1, borderColor: O.cardBorder },
  img: { width: '100%', height: '100%' },
});
