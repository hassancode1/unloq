import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from '../hooks/useTheme';

type Props = { url: string; title?: string; onBack: () => void };

async function fetchBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function pdfHtml(base64: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:auto;background:#525659}
embed{display:block;width:100%;height:100%}
</style>
</head>
<body>
<embed src="data:application/pdf;base64,${base64}" type="application/pdf" width="100%" height="100%">
</body>
</html>`;
}

export default function PdfViewerScreen({ url, title, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { C, F, fs } = useTheme();
  const [html, setHtml]   = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchBase64(url)
      .then(b64 => setHtml(pdfHtml(b64)))
      .catch((err) => {
        console.error('[PdfViewer] load failed:', err);
        setError(true);
      });
  }, [url]);

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <View style={[S.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity style={S.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: F.bold, fontSize: fs(16), color: C.text, flex: 1 }} numberOfLines={1}>
          {title ?? 'PDF'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {error ? (
        <View style={S.center}>
          <Ionicons name="alert-circle-outline" size={44} color={C.muted} />
          <Text style={[S.errText, { fontFamily: F.semiBold, color: C.muted, fontSize: fs(14) }]}>
            Could not load PDF.{'\n'}Check your connection and try again.
          </Text>
        </View>
      ) : !html ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={{ fontFamily: F.regular, color: C.muted, fontSize: fs(13), marginTop: 12 }}>
            Loading PDF…
          </Text>
        </View>
      ) : (
        <WebView
          source={{ html, baseUrl: '' }}
          style={{ flex: 1 }}
          originWhitelist={['*']}
          scrollEnabled
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 36, height: 36, justifyContent: 'center', marginRight: 8 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errText: { textAlign: 'center', marginTop: 14, lineHeight: 22 },
});
