import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, G, ClipPath, Defs, Rect } from 'react-native-svg';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth } from 'convex/react';
import Toast from 'react-native-toast-message';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onAuthSuccess: () => void;
};

export default function AuthModal({ visible, onDismiss, onAuthSuccess }: Props) {
  const { C, F, fs } = useTheme();
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const [loading, setLoading] = useState(false);

  // When auth completes (isAuthenticated flips to true), trigger success
  React.useEffect(() => {
    if (visible && isAuthenticated) {
      onAuthSuccess();
    }
  }, [isAuthenticated, visible]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      // Step 1: Initiate — library returns redirect URL but does NOT open browser in RN
      const result = await signIn('google', { redirectTo: 'loqlearn://' });

      if (result && 'redirect' in result && result.redirect) {
        // Step 2: Open the browser ourselves
        const browserResult = await WebBrowser.openAuthSessionAsync(
          result.redirect.toString(),
          'loqlearn://'
        );

        if (browserResult.type === 'success') {
          // Step 3: Extract the code from the redirect URL
          const url = new URL(browserResult.url);
          const code = url.searchParams.get('code');
          if (code) {
            // Step 4: Complete sign-in with the code (verifier auto-read from storage)
            await (signIn as any)(undefined, { code });
          }
        }
      }
    } catch (e: any) {
      console.log('[Auth] error:', e?.message);
      Toast.show({ type: 'error', text1: 'Sign in failed', text2: e?.message ?? 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onDismiss} />

      {/* Sheet */}
      <View style={[styles.sheet, { backgroundColor: C.surface, borderColor: C.border }]}>
        {/* Drag handle */}
        <View style={[styles.handle, { backgroundColor: C.border }]} />

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: `${C.primary}14`, borderColor: `${C.primary}28` }]}>
          <Text style={{ fontSize: 32 }}>📄</Text>
        </View>

        {/* Text */}
        <Text style={[styles.title, { fontSize: fs(20), fontFamily: F.bold, color: C.text }]}>
          Sign in to upload
        </Text>
        <Text style={[styles.subtitle, { fontSize: fs(13), fontFamily: F.regular, color: C.sub }]}>
          Your courses are saved to your account and synced across devices.
        </Text>

        {/* Google button */}
        <TouchableOpacity
          style={[styles.googleBtn, { borderColor: C.border }]}
          activeOpacity={0.75}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <>
              <Svg width={20} height={20} viewBox="0 0 48 48">
                <Defs>
                  <ClipPath id="g">
                    <Path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
                  </ClipPath>
                </Defs>
                <G clipPath="url(#g)">
                  <Path d="M0 37V11l17 13z" fill="#FBBC05" />
                  <Path d="M0 11l17 13 7-6.1L48 14V0H0z" fill="#EA4335" />
                  <Path d="M0 37l30-23 7.9 1L48 0v48H0z" fill="#34A853" />
                  <Path d="M48 48L17 24l-4-3 35-10z" fill="#4285F4" />
                </G>
              </Svg>
              <Text style={[styles.googleText, { fontSize: fs(15), fontFamily: F.semiBold }]}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Fine print */}
        <Text style={[styles.fine, { fontSize: fs(11), fontFamily: F.regular, color: C.muted }]}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 36,
    paddingTop: Spacing.md,
    alignItems: 'center',
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.sm,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    marginTop: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  googleText: {
    color: '#1f1f1f',
  },
  fine: {
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: Spacing.md,
    marginTop: -Spacing.sm,
  },
});
