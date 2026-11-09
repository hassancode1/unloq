import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, G, ClipPath, Defs, Rect } from 'react-native-svg';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth } from 'convex/react';
import Toast from 'react-native-toast-message';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';
import Glim from '../components/mascot/Glim';
import { paletteForInterests } from '../components/mascot/palettes';
import { useAppStore } from '../store/useAppStore';

/** Why we're asking — changes the copy so it's clear what signing in unlocks. */
export type AuthReason = 'notes' | 'path' | 'upgrade' | 'account' | 'save' | 'restore';

// {name} = the user's Glim.
const COPY: Record<AuthReason, { title: string; sub: string }> = {
  notes:   { title: 'Sign in to add notes', sub: 'Your notes and PDFs are stored in your account, so they’re backed up and on every device.' },
  path:    { title: 'Sign in to create paths', sub: 'Build a path on anything you want to learn. It’s saved to your account.' },
  upgrade: { title: 'Sign in to upgrade', sub: 'Your subscription is tied to your account, so you never lose it.' },
  account: { title: 'Sign in', sub: 'Back up {name}, your streak and your subscription, and pick up on any phone.' },
  save:    { title: 'Save {name} to your account', sub: 'So {name}, your streak and your trial are safe if you ever change or reset your phone.' },
  restore: { title: 'Welcome back', sub: 'Sign in to bring back your Glim, streak and paths.' },
};

type Props = {
  visible: boolean;
  reason?: AuthReason;
  onDismiss: () => void;
  onAuthSuccess: () => void;
};

export default function AuthModal({ visible, reason = 'account', onDismiss, onAuthSuccess }: Props) {
  const { C, F, fs } = useTheme();
  const glimProfile = useAppStore((st) => st.glim);
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  // Start collapsed every time the sheet opens.
  useEffect(() => { if (visible) { setShowEmail(false); setEmailError(null); } }, [visible]);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  // When auth completes (isAuthenticated flips to true), trigger success
  React.useEffect(() => {
    if (visible && isAuthenticated) {
      onAuthSuccess();
    }
  }, [isAuthenticated, visible]);

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token returned');
      await signIn('apple-native', {
        identityToken: credential.identityToken,
        user: credential.user,
        ...(credential.email ? { email: credential.email } : {}),
      });
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Toast.show({ type: 'error', text1: 'Sign in failed', text2: e?.message ?? 'Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

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
      Toast.show({ type: 'error', text1: 'Sign in failed', text2: e?.message ?? 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) return;
    setEmailLoading(true);
    setEmailError(null);
    try {
      await signIn('password', { email, password, flow: isSignUp ? 'signUp' : 'signIn' });
    } catch (e: any) {
      const msg: string = e?.message ?? 'Authentication failed';
      setEmailError(msg);
      Toast.show({
        type: 'error',
        text1: isSignUp ? 'Sign up failed' : 'Sign in failed',
        text2: msg,
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp((prev) => !prev);
    setEmailError(null);
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kavWrapper}
      >
        {/* Sheet */}
        <View style={[styles.sheet, { backgroundColor: C.surface, borderColor: C.border }]}>
          {/* Drag handle */}
          <View style={[styles.handle, { backgroundColor: C.borderStrong }]} />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Glim size={56} stage={glimProfile.stage} palette={paletteForInterests(glimProfile.interests)} mood="happy" interactive={false} wander={false} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: fs(20), fontFamily: F.extraBold, color: C.text, letterSpacing: -0.4 }}>
                  {showEmail && isSignUp ? 'Create an account' : COPY[reason].title.replace(/\{name\}/g, glimProfile.name || 'Glim')}
                </Text>
                <Text style={{ fontSize: fs(13), lineHeight: fs(18), fontFamily: F.regular, color: C.sub }}>
                  {COPY[reason].sub.replace(/\{name\}/g, glimProfile.name || 'Glim')}
                </Text>
              </View>
            </View>

            {/* Apple + Google — same size, Apple first (App Store guideline 4.8) */}
            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={12}
                style={styles.providerBtn}
                onPress={handleAppleSignIn}
              />
            )}
            <TouchableOpacity
              style={[styles.providerBtn, styles.googleBtn, { borderColor: C.border, backgroundColor: C.surfaceAlt }]}
              activeOpacity={0.75}
              onPress={handleGoogleSignIn}
              disabled={loading || emailLoading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={C.text} />
              ) : (
                <>
                  <Svg width={17} height={17} viewBox="0 0 48 48">
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
                  <Text style={{ fontSize: fs(15), fontFamily: F.semiBold, color: C.text }}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Email — collapsed behind a link so the sheet stays small */}
            {!showEmail ? (
              <TouchableOpacity onPress={() => setShowEmail(true)} activeOpacity={0.7} hitSlop={8} style={{ paddingVertical: 4 }}>
                <Text style={{ fontSize: fs(14), fontFamily: F.semiBold, color: C.sub }}>Continue with email</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: '100%', gap: 10 }}>
                <TextInput
                  style={[styles.input, { backgroundColor: C.surfaceAlt, borderColor: C.border, color: C.text, fontSize: fs(15), fontFamily: F.regular }]}
                  placeholder="Email"
                  placeholderTextColor={C.muted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  autoFocus
                  editable={!emailLoading}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: C.surfaceAlt, borderColor: C.border, color: C.text, fontSize: fs(15), fontFamily: F.regular }]}
                  placeholder="Password"
                  placeholderTextColor={C.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  editable={!emailLoading}
                  returnKeyType="go"
                  onSubmitEditing={handleEmailSignIn}
                />
                {emailError && (
                  <Text style={{ fontSize: fs(12), fontFamily: F.regular, color: C.error }}>{emailError}</Text>
                )}
                <TouchableOpacity
                  style={[styles.providerBtn, { backgroundColor: C.text, opacity: !email || !password ? 0.4 : 1 }]}
                  activeOpacity={0.8}
                  onPress={handleEmailSignIn}
                  disabled={emailLoading || loading || !email || !password}
                >
                  {emailLoading ? (
                    <ActivityIndicator size="small" color={C.bg} />
                  ) : (
                    <Text style={{ fontSize: fs(15), fontFamily: F.semiBold, color: C.bg }}>
                      {isSignUp ? 'Create account' : 'Sign in'}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleMode} activeOpacity={0.7} style={{ alignSelf: 'center' }}>
                  <Text style={{ fontSize: fs(13), fontFamily: F.regular, color: C.sub }}>
                    {isSignUp ? 'Have an account? ' : 'New here? '}
                    <Text style={{ color: C.text, fontFamily: F.semiBold }}>{isSignUp ? 'Sign in' : 'Create one'}</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {(reason === 'save' || reason === 'restore') && (
              <TouchableOpacity onPress={onDismiss} style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Text style={{ fontSize: fs(14), fontFamily: F.semiBold, color: C.sub }}>
                  {reason === 'save' ? 'Maybe later' : 'Start fresh instead'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Fine print with tappable links — required by App Store guideline 3.1.2(c) */}
            <Text style={[styles.fine, { fontSize: fs(11), fontFamily: F.regular, color: C.muted }]}>
              By continuing you agree to our{' '}
              <Text
                style={{ color: C.sub, textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL('https://hassancode1.github.io/unloq/terms-of-service.html')}
              >
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text
                style={{ color: C.sub, textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL('https://hassancode1.github.io/unloq/privacy-policy.html')}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  kavWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 34,
    paddingTop: 10,
  },
  scrollContent: { alignItems: 'center', gap: 12, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 6, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%', marginBottom: 6 },
  providerBtn: { width: '100%', height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  googleBtn: { flexDirection: 'row', gap: 9, borderWidth: 1 },
  input: { width: '100%', height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  fine: { textAlign: 'center', lineHeight: 16, paddingHorizontal: Spacing.md, marginTop: 2 },
});
