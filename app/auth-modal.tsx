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
import { useAuthActions } from '@convex-dev/auth/react';
import Toast from 'react-native-toast-message';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';

// Required so the OAuth browser session can redirect back into the app
WebBrowser.maybeCompleteAuthSession();

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onAuthSuccess: () => void;
};

export default function AuthModal({ visible, onDismiss, onAuthSuccess }: Props) {
  const { C, F, fs } = useTheme();
  const { signIn } = useAuthActions();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signIn('google', { redirectTo: 'loqlearn://' });
      onAuthSuccess();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Sign in failed', text2: 'Please try again.' });
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
              <Text style={styles.googleG}>G</Text>
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
  googleG: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
    lineHeight: 22,
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
