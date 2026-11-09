// The one paywall: founder video, the plans from RevenueCat's *current
// offering*, and a single button straight to Apple's purchase sheet.
//
// Everything that matters for experiments comes from RevenueCat, so price,
// trial and copy tests need no app update:
//  • Plans + prices + trial: the offering's Annual / Monthly packages
//    (RevenueCat Experiments swap the offering per user).
//  • Copy: optional offering metadata (dashboard → Offering → Metadata), e.g.
//    { "headline": "Wake {name} up", "subheadline": "...", "highlight": "annual",
//      "badge": "Best value", "show_timeline": true }
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Purchases, { INTRO_ELIGIBILITY_STATUS, type PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import AuthModal from '../../app/auth-modal';
import { afterUnlock } from '../../lib/pro';
import { useAppStore } from '../../store/useAppStore';
import Glim from '../mascot/Glim';
import { paletteForInterests } from '../mascot/palettes';
import { F, GlowButton, O, alpha } from '../onboarding/ui';

/**
 * The founder video. Record it vertically (9:16), 20–40 s, captions burned in
 * (it starts muted). Save as assets/paywall/founder.mp4 and set:
 *   const FOUNDER_VIDEO: number | null = require('../../assets/paywall/founder.mp4');
 * Rebuild once (expo-video is native). Until then, Glim stands in.
 */
const FOUNDER_VIDEO: number | null = null;
// expo-video is native: only load it once there's a video to play.
const FounderVideo: React.ComponentType<{ source: number }> | null =
  FOUNDER_VIDEO != null ? require('./FounderVideo').default : null;

interface Plan {
  key: 'annual' | 'monthly';
  pkg: PurchasesPackage;
  title: string;
  price: string;          // "$49.99/year"
  perMonth: string;       // "$4.17" — shown for both plans so they compare at a glance
  billing: string;        // "$49.99 billed yearly" / "Billed monthly"
  trialDays: number | null; // free trial length if this user is eligible
}

interface Meta {
  headline?: string;
  subheadline?: string;
  highlight?: 'annual' | 'monthly';
  badge?: string;
  show_timeline?: boolean;
}

const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined);

/** StoreKit/RevenueCat calls can hang (simulator, no sandbox account, bad network). */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

function trialDaysOf(pkg: PurchasesPackage): number | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const n = intro.periodNumberOfUnits;
  switch (intro.periodUnit) {
    case 'DAY': return n;
    case 'WEEK': return n * 7;
    case 'MONTH': return n * 30;
    default: return n;
  }
}

function usePlans() {
  const [state, setState] = useState<{ plans: Plan[]; meta: Meta; loading: boolean; failed: boolean }>({
    plans: [], meta: {}, loading: true, failed: false,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const offerings = await withTimeout(Purchases.getOfferings(), 10000, 'getOfferings');
        const offering = offerings.current;
        if (__DEV__) {
          console.log('[Paywall] offerings:', Object.keys(offerings.all), 'current:', offering?.identifier,
            'packages:', offering?.availablePackages.map((p) => `${p.packageType}:${p.product.identifier}`),
            'metadata:', JSON.stringify(offering?.metadata ?? {}));
        }
        if (!offering) throw new Error('No current offering');
        const pkgs = [
          offering.annual && { key: 'annual' as const, pkg: offering.annual, title: 'Annual' },
          offering.monthly && { key: 'monthly' as const, pkg: offering.monthly, title: 'Monthly' },
        ].filter(Boolean) as { key: Plan['key']; pkg: PurchasesPackage; title: string }[];
        if (!pkgs.length) throw new Error('Offering has no Annual/Monthly package');

        // Apple gives the intro offer only to people who never subscribed in the group.
        // Unknown/slow → assume eligible; Apple's sheet shows the real terms anyway.
        const elig = await withTimeout(
          Purchases.checkTrialOrIntroductoryPriceEligibility(pkgs.map((p) => p.pkg.product.identifier)),
          4000, 'trialEligibility',
        ).catch(() => ({} as Record<string, { status: INTRO_ELIGIBILITY_STATUS }>));
        const eligible = (id: string) => {
          const st = elig[id]?.status;
          return st === undefined || st === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
            || st === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_UNKNOWN;
        };

        const plans: Plan[] = pkgs.map(({ key, pkg, title }) => ({
          key, pkg, title,
          price: `${pkg.product.priceString}/${key === 'annual' ? 'year' : 'month'}`,
          perMonth: key === 'annual' ? pkg.product.pricePerMonthString ?? pkg.product.priceString : pkg.product.priceString,
          billing: key === 'annual' ? `${pkg.product.priceString} billed yearly` : 'Billed monthly',
          trialDays: eligible(pkg.product.identifier) ? trialDaysOf(pkg) : null,
        }));
        const m = offering.metadata ?? {};
        const meta: Meta = {
          headline: str(m.headline),
          subheadline: str(m.subheadline),
          highlight: m.highlight === 'monthly' ? 'monthly' : m.highlight === 'annual' ? 'annual' : undefined,
          badge: str(m.badge),
          show_timeline: typeof m.show_timeline === 'boolean' ? m.show_timeline : undefined,
        };
        if (!cancelled) setState({ plans, meta, loading: false, failed: false });
      } catch (e) {
        if (__DEV__) console.warn('[Paywall] plans failed:', e instanceof Error ? e.message : e);
        if (!cancelled) setState((st) => ({ ...st, loading: false, failed: true }));
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  return { ...state, retry: () => { setState((st) => ({ ...st, loading: true, failed: false })); setTick((t) => t + 1); } };
}

interface Props {
  /** Shown as a modal (soft paywall / in-app unlocks): adds a close button. */
  onClose?: () => void;
  /** Called after a successful purchase or restore. */
  onUnlocked?: () => void;
}

export default function Paywall({ onClose, onUnlocked }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const glim = useAppStore((s) => s.glim);
  const name = glim.name || 'Glim';
  const palette = paletteForInterests(glim.interests);
  // Selection is white, like the button — Glim's colour is for Glim, not the UI.
  const accent = O.text;
  const { plans, meta, loading, failed, retry } = usePlans();
  const [hadPro, setHadPro] = useState(false);
  const [selected, setSelected] = useState<Plan['key']>('annual');
  const [busy, setBusy] = useState<null | 'buy' | 'restore'>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    // Trial/subscription that ended vs. never started — changes the wording.
    Purchases.getCustomerInfo().then((info) => setHadPro(!!info.entitlements.all['premium'])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!plans.length) return;
    const want = meta.highlight ?? 'annual';
    setSelected(plans.some((p) => p.key === want) ? want : plans[0].key);
  }, [plans, meta.highlight]);

  const plan = plans.find((p) => p.key === selected);
  const annual = plans.find((p) => p.key === 'annual');
  const monthly = plans.find((p) => p.key === 'monthly');
  const savePct = useMemo(() => {
    if (!annual || !monthly) return null;
    const full = monthly.pkg.product.price * 12;
    return full > 0 ? Math.round((1 - annual.pkg.product.price / full) * 100) : null;
  }, [annual, monthly]);

  const fill = (t: string) => t.replace(/\{name\}/g, name);
  const headline = meta.headline ? fill(meta.headline) : hadPro ? `${name} misses you` : `Wake ${name} up`;
  const sub = meta.subheadline
    ? fill(meta.subheadline)
    : hadPro ? 'Your progress is saved. Pick up right where you left off.' : 'Learn one real thing a day instead of scrolling, and watch it grow.';
  const trial = plan?.trialDays ?? null;
  const showTimeline = !!trial && meta.show_timeline !== false;

  const buy = async () => {
    if (!plan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setBusy('buy');
    try {
      const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
      if (customerInfo.entitlements.active['premium'] || customerInfo.activeSubscriptions.length) {
        afterUnlock();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onUnlocked?.();
      }
    } catch (e: any) {
      if (!e?.userCancelled) Toast.show({ type: 'error', text1: 'Purchase didn’t go through', text2: 'You haven’t been charged. Try again in a moment.' });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const info = await Purchases.restorePurchases();
      const ok = !!info.entitlements.active['premium'] || info.activeSubscriptions.length > 0;
      if (ok) { Toast.show({ type: 'success', text1: `Welcome back — ${name} is awake` }); onUnlocked?.(); }
      else Toast.show({ type: 'info', text1: 'No active subscription found', text2: 'Signed up with a different Apple ID or account? Try signing in.' });
    } catch {
      Toast.show({ type: 'error', text1: 'Couldn’t restore', text2: 'Check your connection and try again.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      {onClose && (
        <Pressable onPress={onClose} hitSlop={12} style={s.close} accessibilityLabel="Close">
          <Ionicons name="close" size={20} color={O.sub} />
        </Pressable>
      )}

      {/* founder video in a frame; until it's recorded, Glim floats on its own glow */}
      {FounderVideo && FOUNDER_VIDEO != null ? (
        <Animated.View entering={FadeIn.duration(500)} style={[s.media, { height: Math.round(height * 0.32) }]}>
          <FounderVideo source={FOUNDER_VIDEO} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(600)} style={[s.hero, { height: Math.round(height * 0.27) }]}>
          <Glim size={168} stage={glim.stage} palette={palette} mood={hadPro ? 'sleepy' : 'happy'} wander={false} />
        </Animated.View>
      )}

      <View style={{ alignItems: 'center', gap: 6, marginTop: 16 }}>
        <Animated.Text entering={FadeInDown.delay(120).duration(380)} style={s.title}>{headline}</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(190).duration(380)} style={s.sub}>{sub}</Animated.Text>
      </View>

      {/* plans */}
      <View style={{ flex: 1, justifyContent: 'center', gap: 10 }}>
        {loading ? (
          <ActivityIndicator color={O.sub} />
        ) : failed ? (
          <Pressable onPress={retry} style={[s.plan, { alignItems: 'center' }]}>
            <Text style={s.planTitle}>Couldn’t load plans</Text>
            <Text style={s.planSub}>Tap to try again</Text>
          </Pressable>
        ) : (
          plans.map((p, i) => {
            const on = p.key === selected;
            return (
              <Animated.View key={p.key} entering={FadeInDown.delay(250 + i * 70).duration(360)}>
                <Pressable
                  onPress={() => { if (!on) { Haptics.selectionAsync().catch(() => {}); setSelected(p.key); } }}
                  style={[s.plan, on && { borderColor: accent, backgroundColor: alpha('#FFFFFF', 0.04) }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <View style={[s.radio, on && { borderColor: accent }]}>{on && <View style={[s.radioDot, { backgroundColor: accent }]} />}</View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={s.planTitle}>{p.title}</Text>
                      {p.key === 'annual' && (meta.badge || (savePct && savePct > 0)) && (
                        <View style={[s.badge, { backgroundColor: on ? accent : O.cardBorder }]}>
                          <Text style={[s.badgeText, !on && { color: O.text }]}>{meta.badge ?? `Save ${savePct}%`}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.planSub}>
                      {p.trialDays ? `${p.trialDays} days free · then ${p.billing.toLowerCase()}` : p.billing}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.perMonth, !on && { color: O.sub }]}>{p.perMonth}</Text>
                    <Text style={s.perMonthUnit}>per month</Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })
        )}

        {showTimeline && plan && (
          <Animated.View entering={FadeIn.duration(300)} style={s.timeline}>
            <Text style={s.timelineText}>
              <Text style={{ color: O.text }}>Today</Text> free · <Text style={{ color: O.text }}>Day {trial}</Text> plan starts
            </Text>
          </Animated.View>
        )}
      </View>

      {/* action */}
      <View>
        <View style={s.trust}>
          {['Cancel anytime', 'No ads', 'Progress always saved'].map((t) => (
            <View key={t} style={s.trustItem}>
              <Ionicons name="checkmark" size={13} color={palette[1]} />
              <Text style={s.trustText}>{t}</Text>
            </View>
          ))}
        </View>
        <GlowButton
          label={trial ? 'Start my free trial' : 'Subscribe'}
          loading={busy === 'buy'}
          disabled={busy === 'restore' || !plan}
          onPress={buy}
        />
        <Text style={s.fine}>
          {plan
            ? trial
              ? `${trial} days free, then ${plan.price}. Cancel anytime in Settings.`
              : `${plan.price}. Renews automatically, cancel anytime in Settings.`
            : ' '}
        </Text>
        <View style={s.row}>
          <Pressable onPress={restore} disabled={!!busy} hitSlop={8} style={s.link}>
            {busy === 'restore' ? <ActivityIndicator size="small" color={O.sub} /> : <Text style={s.linkText}>Restore</Text>}
          </Pressable>
          <Text style={s.dot}>·</Text>
          <Pressable onPress={() => setShowAuth(true)} disabled={!!busy} hitSlop={8} style={s.link}>
            <Text style={s.linkText}>Sign in</Text>
          </Pressable>
          <Text style={s.dot}>·</Text>
          <Text style={s.linkText} onPress={() => Linking.openURL('https://hassancode1.github.io/unloq/terms-of-service.html')}>Terms</Text>
          <Text style={s.dot}>·</Text>
          <Text style={s.linkText} onPress={() => Linking.openURL('https://hassancode1.github.io/unloq/privacy-policy.html')}>Privacy</Text>
        </View>
      </View>

      <AuthModal
        visible={showAuth}
        reason="restore"
        onDismiss={() => setShowAuth(false)}
        // Signing in links RevenueCat to the account; if it has Pro, the gate opens.
        onAuthSuccess={() => setShowAuth(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: O.bg, paddingHorizontal: 20 },
  close: {
    position: 'absolute', zIndex: 2, right: 18, top: 54, width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', backgroundColor: O.card,
  },
  media: { borderRadius: 26, overflow: 'hidden', backgroundColor: O.card, borderWidth: 1, borderColor: O.cardBorder },
  hero: { alignItems: 'center', justifyContent: 'center' },
  title: { color: O.text, fontFamily: F.black, fontSize: 28, letterSpacing: -0.7, textAlign: 'center' },
  sub: { color: O.sub, fontFamily: F.regular, fontSize: 15, lineHeight: 21, textAlign: 'center', paddingHorizontal: 8 },
  plan: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1.5,
    borderColor: O.cardBorder, backgroundColor: O.card, paddingHorizontal: 16, paddingVertical: 14,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: O.faint, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  planTitle: { color: O.text, fontFamily: F.black, fontSize: 16 },
  planSub: { color: O.sub, fontFamily: F.regular, fontSize: 13 },
  perMonth: { color: O.text, fontFamily: F.black, fontSize: 18, letterSpacing: -0.3 },
  perMonthUnit: { color: O.sub, fontFamily: F.regular, fontSize: 11, marginTop: 1 },
  trust: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginBottom: 14 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { color: O.sub, fontFamily: F.semi, fontSize: 12 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: O.bg, fontFamily: F.bold, fontSize: 11 },
  timeline: { alignItems: 'center', marginTop: 2 },
  timelineText: { color: O.sub, fontFamily: F.semi, fontSize: 13 },
  fine: { color: O.sub, fontFamily: F.regular, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  link: { paddingVertical: 6, minHeight: 28, justifyContent: 'center' },
  linkText: { color: O.sub, fontFamily: F.bold, fontSize: 13 },
  dot: { color: O.faint, fontSize: 13 },
});
