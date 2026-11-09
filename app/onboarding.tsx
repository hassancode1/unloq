import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useConvexAuth, useQuery } from 'convex/react';
import Toast from 'react-native-toast-message';
import AuthModal from './auth-modal';

import Glim, { GLIM_STAGES, GlimHandle, GlimMood, GlimStage } from '../components/mascot/Glim';
import { STAGE_XP } from '../lib/quests';
import { paletteForInterests } from '../components/mascot/palettes';
import { HoldButton, HoursSlider } from '../components/onboarding/controls';
import { INTERESTS, MINUTE_OPTIONS, SCROLL_WINDOWS, hoursMood } from '../components/onboarding/content';
import { Caption, Chip, Dust, F, GlowButton, O, Sub, TapToContinue, TopBar, alpha, useCountUp } from '../components/onboarding/ui';
import { requestNotificationPermission } from '../lib/notifications';
import { openPaywall } from '../lib/pro';
import { HARD_PAYWALL } from '../lib/features';
import { api } from '../convex/_generated/api';
import { DEMO_FACTS } from '../convex/lib/demoFacts';
import { VoiceExplain, type Explanation } from '../components/onboarding/VoiceExplain';
import { useAppStore } from '../store/useAppStore';
import { GrowVisual, ReadVisual, VoiceVisual } from '../components/onboarding/howVisuals';

// ── Flow ───────────────────────────────────────────────────────────────────────
type Step =
  | 'intro' | 'dim' | 'spark'
  | 'name' | 'hours' | 'reveal'
  | 'interests' | 'minutes' | 'when' | 'notify'
  | 'how' | 'teach' | 'growth' | 'commit';

const STEPS: Step[] = [
  'intro', 'dim', 'spark',
  'name', 'hours', 'reveal',
  'interests', 'minutes', 'when', 'notify',
  'how', 'teach', 'growth', 'commit',
];
const TAP_STEPS: Step[] = ['intro', 'dim', 'spark'];
const PROGRESS_STEPS = STEPS.filter((s) => !TAP_STEPS.includes(s));
const NO_BACK: Step[] = ['name', 'teach', 'growth', 'commit'];

/** Where Glim sits (centre, as a fraction of screen height) and how big it is. */
function poseFor(step: Step) {
  switch (step) {
    case 'intro': case 'dim': case 'spark': return { y: 0.42, scale: 1 };
    case 'name':      return { y: 0.2,  scale: 0.72 };
    case 'hours':     return { y: 0.27, scale: 0.85 };
    case 'reveal':    return { y: 0.25, scale: 0.8 };
    case 'interests': return { y: 0.17, scale: 0.55 };
    case 'how':       return { y: 0.17, scale: 0.6 };
    case 'teach':     return { y: 0.13, scale: 0.48 };
    case 'minutes':   return { y: 0.22, scale: 0.7 };
    case 'when':      return { y: 0.15, scale: 0.5 };
    case 'notify':    return { y: 0.36, scale: 1 };
    case 'growth':    return { y: 0.24, scale: 0.8 };
    case 'commit':    return { y: 0.33, scale: 1 };
  }
}

// ── Layout primitives (outside the screen so they keep identity across renders) ──
const LayoutCtx = React.createContext({ below: 0, baseBottom: 0 });

function Body({ children, scroll }: { children: React.ReactNode; scroll?: boolean }) {
  const { below, baseBottom } = React.useContext(LayoutCtx);
  return scroll ? (
    <ScrollView
      style={[st.body, { top: below, bottom: baseBottom + 80 }]}
      contentContainerStyle={{ paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[st.body, { top: below }]}>{children}</View>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  const { baseBottom } = React.useContext(LayoutCtx);
  const kb = useAnimatedKeyboard();
  const style = useAnimatedStyle(() => ({ bottom: Math.max(baseBottom, kb.height.value + 12) }));
  return <Animated.View style={[st.footer, style]}>{children}</Animated.View>;
}

const GLIM_SIZE = 220;
const GLIM_H = GLIM_SIZE * 1.2; // Glim's layout box height

type Props = { onComplete: () => void };

export default function OnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const updateGlim = useAppStore((s) => s.updateGlim);
  const glim = useRef<GlimHandle>(null);

  const [i, setI] = useState(0);
  const step = STEPS[i];
  const enteredAt = useRef(Date.now());

  const [name, setName] = useState('');
  const [hours, setHours] = useState(4);
  const [interests, setInterests] = useState<string[]>([]);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [windows, setWindows] = useState<string[]>([]);
  const [teaser, setTeaser] = useState(false);
  // Glim is a Spark until it learns its first fact in the teach step — that's
  // its first evolution (to Glow). Skipping keeps it a Spark until the first quest.
  const [taught, setTaught] = useState(false);

  // "I already have an account": sign in, ProgressSync restores the backup,
  // and we skip the rest of onboarding.
  const { isAuthenticated } = useConvexAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const backup = useQuery(api.progress.mine, restoring && isAuthenticated ? {} : 'skip');
  const restoredGlim = useAppStore((s) => s.glim.interests.length > 0);
  useEffect(() => {
    if (!restoring || !isAuthenticated) return;
    if (restoredGlim) { onComplete(); return; }
    if (backup === null || (backup && !backup.data?.glim?.interests?.length)) {
      setRestoring(false);
      Toast.show({ type: 'info', text1: 'No saved Glim on this account yet', text2: 'Let’s make one — it’ll be backed up from now on.' });
    }
  }, [restoring, isAuthenticated, restoredGlim, backup]);

  const petName = name.trim() || 'Glim';
  const palette = useMemo(() => paletteForInterests(interests), [interests]);
  const accent = interests.length ? palette[1] : '#7FB2FF';

  // ── Glim's state is a function of where we are ──
  const stage: GlimStage = teaser ? 3 : taught ? 1 : 0;
  const hoursDroop = Math.min(1, Math.max(0, (hours - 1) / 9));
  const droop = (() => {
    switch (step) {
      case 'intro': return 0.55;
      case 'dim': return 0.95;
      case 'spark': return teaser ? 0 : 0.55;
      case 'name': return 0.45;
      case 'hours': case 'reveal': return hoursDroop;
      case 'interests': return Math.max(0.1, 0.45 - interests.length * 0.1);
      case 'how': return 0.1;
      case 'minutes': return 0.12;
      case 'when': return 0.1;
      case 'notify': return 0.08;
      default: return 0;
    }
  })();
  const mood: GlimMood =
    step === 'intro' || step === 'dim' || (step === 'spark' && !teaser) ? 'sleepy'
    : teaser ? 'happy'
    : 'idle';

  // ── Glim's position ──
  const pose = poseFor(step);
  const ty = useSharedValue(-GLIM_H * 1.5);
  const sc = useSharedValue(pose.scale);
  useEffect(() => {
    const target = pose.y * height - GLIM_H / 2;
    if (step === 'intro') {
      // the drop-in: falls from above, lands with a squish
      ty.value = withSpring(target, { damping: 9, stiffness: 90, mass: 1.1 });
      const t = setTimeout(() => {
        glim.current?.poke();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, 560);
      return () => clearTimeout(t);
    }
    ty.value = withSpring(target, { damping: 16, stiffness: 110 });
    sc.value = withSpring(pose.scale, { damping: 14, stiffness: 120 });
  }, [step, height]);
  const glimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { scale: sc.value }],
  }));
  // Glim sits on the floor of its box (≈42% of the box height below centre), so
  // measure from there and leave breathing room for the glow + caption.
  const below = pose.y * height + GLIM_H * 0.42 * pose.scale + 28;

  // ── Navigation ──
  const go = useCallback((d: number) => {
    enteredAt.current = Date.now();
    Keyboard.dismiss();
    setI((x) => Math.max(0, Math.min(STEPS.length - 1, x + d)));
  }, []);
  const next = useCallback(() => go(1), [go]);
  const back = useCallback(() => go(-1), [go]);

  const tapNext = () => {
    if (Date.now() - enteredAt.current < 700) return; // let the caption land first
    next();
  };

  // ── Step side-effects ──
  useEffect(() => {
    if (step !== 'spark') return;
    const a = setTimeout(() => { setTeaser(true); glim.current?.absorb(); }, 1100);
    const b = setTimeout(() => setTeaser(false), 3600);
    return () => { clearTimeout(a); clearTimeout(b); setTeaser(false); };
  }, [step]);

  const finish = async () => {
    const firstWindow = SCROLL_WINDOWS.find((w) => windows.includes(w.id));
    updateGlim({
      name: petName,
      interests,
      topicMode: 'random',
      dailyMinutes: minutes ?? 10,
      scrollWindows: windows,
      reminderTime: firstWindow?.time ?? '20:00',
      screenHours: hours,
      commitDays: 7,
      xp: taught ? STAGE_XP[1] : 0, // Glow if it learned its first fact, else still a Spark
      stage: taught ? 1 : 0,
    });
    // Hard paywall: Home is gated, so the paywall appears as soon as we finish.
    // Soft paywall: show it as a closable modal first.
    if (!HARD_PAYWALL) await openPaywall();
    onComplete();
  };

  const baseBottom = insets.bottom + 16;

  const progress = (PROGRESS_STEPS.indexOf(step) + 1) / PROGRESS_STEPS.length;

  // ── Step content ──
  const renderStep = () => {
    switch (step) {
      case 'intro':
        return (
          <>
            <Body><Caption text="Meet Glim." delay={700} size={32} /><Sub delay={1300} style={{ marginTop: 10 }}>A tiny spark that lives on learning.</Sub></Body>
            <Footer><TapToContinue delay={1800} /></Footer>
          </>
        );
      case 'dim':
        return (
          <>
            <Body><Caption text="Right now, it’s dimmed by endless scrolling." /></Body>
            <Footer><TapToContinue /></Footer>
          </>
        );
      case 'spark':
        return (
          <>
            <Body>
              <Caption text="But every new thing you learn makes it glow." />
              <Sub delay={3900} style={{ marginTop: 12 }}>Let’s wake it up together.</Sub>
            </Body>
            <Footer><TapToContinue delay={4200} /></Footer>
          </>
        );

      case 'name':
        return (
          <>
            <Body>
              <Caption text="First, give your Glim a name." size={24} />
              <Animated.View entering={FadeIn.delay(500)}>
                <TextInput
                  value={name}
                  onChangeText={(t) => { setName(t); glim.current?.poke(); }}
                  onFocus={() => glim.current?.lookAt(0, 1)}
                  placeholder="Glim"
                  placeholderTextColor={O.faint}
                  maxLength={14}
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => { glim.current?.jump(); setTimeout(next, 500); }}
                  style={st.nameInput}
                  selectionColor={accent}
                />
              </Animated.View>
            </Body>
            <Footer>
              <GlowButton label="That’s the one" onPress={() => { Keyboard.dismiss(); glim.current?.jump(); glim.current?.happy(); setTimeout(next, 550); }} />
              {!isAuthenticated && (
                <GlowButton
                  variant="ghost"
                  label="I already have an account"
                  onPress={() => { Keyboard.dismiss(); setRestoring(true); setShowAuth(true); }}
                  style={{ marginTop: 4 }}
                />
              )}
            </Footer>
          </>
        );

      case 'hours':
        return (
          <>
            <Body>
              <Caption text="How long do you scroll each day?" size={24} />
              <View style={st.bigRow}>
                <Text style={st.big}>{hours}</Text>
                <Text style={st.bigUnit}>{hours >= 12 ? 'h+' : 'h'}</Text>
              </View>
              <Text style={st.moodLine}>{hoursMood(hours).replace('Glim', petName)}</Text>
              <HoursSlider value={hours} onChange={setHours} accent={accent} />
            </Body>
            <Footer><GlowButton label="Continue" onPress={next} /></Footer>
          </>
        );

      case 'reveal':
        return <RevealStep hours={hours} petName={petName} onNext={() => { glim.current?.happy(); next(); }} onCounted={() => glim.current?.no()} />;

      case 'interests': {
        const n = interests.length;
        return (
          <>
            <Body scroll>
              <Caption text="What are you curious about?" size={24} />
              <Sub delay={250} style={{ marginTop: 8, marginBottom: 20 }}>Pick at least 3. {petName} will learn alongside you.</Sub>
              <View style={st.wrap}>
                {INTERESTS.map((it, k) => (
                  <Animated.View key={it.id} entering={FadeInDown.delay(300 + k * 35).duration(300)}>
                    <Chip
                      label={it.label}
                      icon={it.icon}
                      accent={accent}
                      selected={interests.includes(it.id)}
                      onPress={() => {
                        if (interests.includes(it.id)) {
                          setInterests(interests.filter((x) => x !== it.id));
                          glim.current?.poke();
                        } else {
                          setInterests([...interests, it.id]);
                          glim.current?.absorb();
                        }
                      }}
                    />
                  </Animated.View>
                ))}
              </View>
            </Body>
            <Footer>
              <GlowButton label={n < 3 ? `Pick ${3 - n} more` : 'Continue'} disabled={n < 3} onPress={next} />
            </Footer>
          </>
        );
      }

      case 'minutes':
        return (
          <Body>
            <Caption text={`How much time can you give ${petName} a day?`} size={24} />
            <View style={{ gap: 10, marginTop: 24 }}>
              {MINUTE_OPTIONS.map((o, k) => (
                <Animated.View key={o.value} entering={FadeInDown.delay(250 + k * 70).duration(300)}>
                  <Chip
                    wide label={o.label} sub={o.sub} accent={accent}
                    selected={minutes === o.value}
                    onPress={() => {
                      setMinutes(o.value);
                      if (o.value <= 5) glim.current?.nod();
                      else if (o.value <= 10) { glim.current?.happy(); glim.current?.poke(); }
                      else { glim.current?.jump(); glim.current?.happy(); }
                      setTimeout(next, 700);
                    }}
                  />
                </Animated.View>
              ))}
            </View>
          </Body>
        );

      case 'when':
        return (
          <>
            <Body scroll>
              <Caption text="When do you usually reach for your phone?" size={24} />
              <Sub delay={250} style={{ marginTop: 8, marginBottom: 20 }}>That’s when {petName} will have a quest ready.</Sub>
              <View style={{ gap: 10 }}>
                {SCROLL_WINDOWS.map((w, k) => (
                  <Animated.View key={w.id} entering={FadeInDown.delay(300 + k * 50).duration(300)}>
                    <Chip
                      wide label={w.label} icon={w.icon} accent={accent}
                      selected={windows.includes(w.id)}
                      onPress={() => {
                        setWindows(windows.includes(w.id) ? windows.filter((x) => x !== w.id) : [...windows, w.id]);
                        glim.current?.poke();
                      }}
                    />
                  </Animated.View>
                ))}
              </View>
            </Body>
            <Footer><GlowButton label="Continue" disabled={!windows.length} onPress={next} /></Footer>
          </>
        );

      case 'notify':
        return (
          <>
            <Body>
              <Caption text={`Can ${petName} nudge you when a quest is ready?`} size={24} />
              <Sub delay={400} style={{ marginTop: 10 }}>One gentle reminder a day. Never spam.</Sub>
            </Body>
            <Footer>
              <GlowButton
                label="Yes, remind me"
                onPress={async () => {
                  await requestNotificationPermission().catch(() => false);
                  glim.current?.jump(); glim.current?.happy();
                  setTimeout(next, 600);
                }}
              />
              <GlowButton variant="ghost" label="Not now" onPress={next} style={{ marginTop: 4 }} />
            </Footer>
          </>
        );

      case 'how':
        return (
          <>
            <Body>
              <Caption text={`Here’s how ${petName} grows.`} size={26} />
              <View style={{ gap: 14, marginTop: 26 }}>
                {([
                  { v: 'read', title: 'Read today’s topic', sub: 'A short resource on something you’re into.' },
                  { v: 'voice', title: 'Explain it out loud', sub: 'One take. You’ll get sharper at saying what you mean.' },
                  { v: 'grow', title: 'Get graded, watch it grow', sub: `The better you explain it, the more ${petName} grows.` },
                ] as const).map((r, k) => (
                  <Animated.View key={r.title} entering={FadeInDown.delay(400 + k * 220).duration(300)} style={st.howRow}>
                    {r.v === 'read' ? <ReadVisual accent={accent} />
                      : r.v === 'voice' ? <VoiceVisual accent={accent} />
                      : <GrowVisual accent={accent} palette={palette} />}
                    <View style={{ flex: 1 }}>
                      <Text style={st.howTitle}>{r.title}</Text>
                      <Text style={st.howSub}>{r.sub}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>
            </Body>
            <Footer><GlowButton label="Got it" onPress={() => { glim.current?.nod(); next(); }} /></Footer>
          </>
        );

      case 'teach':
        return (
          <TeachStep
            factId={interests[0] ?? 'science'}
            petName={petName}
            accent={O.text} // white mic + controls on the teach screen
            glim={glim}
            onLearned={() => setTaught(true)}
            onDone={() => { glim.current?.lookAt(0, 0); next(); }}
          />
        );

      case 'growth':
        return (
          <>
            <Body>
              <Caption text="This is only the beginning." size={24} />
              <View style={st.stagesRow}>
                {GLIM_STAGES.map((sg, k) => (
                  <Animated.View key={sg.name} entering={FadeInDown.delay(400 + k * 120).duration(300)} style={[st.stageCell, { opacity: k <= stage ? 1 : 0.32 }]}>
                    <View style={[st.stageRing, k === stage && { borderColor: accent }]}>
                      <Glim size={44} stage={k as GlimStage} palette={palette} interactive={false} wander={false} />
                    </View>
                    <Text style={[st.stageName, k === stage && { color: O.text }]}>{sg.name}</Text>
                  </Animated.View>
                ))}
              </View>
              <Animated.View entering={FadeIn.delay(1200)} style={{ marginTop: 26 }}>
                <Text style={st.xpCaption}>
                  {taught ? `${petName} just evolved into Glow. Your first topic is waiting.` : `${petName} is a Spark. Your first quest will make it glow.`}
                </Text>
              </Animated.View>
            </Body>
            <Footer><GlowButton label="Continue" onPress={next} /></Footer>
          </>
        );

      case 'commit':
        return (
          <>
            <Body>
              <Caption text={`Commit to 7 days with ${petName}?`} size={26} />
              <Sub delay={400} style={{ marginTop: 10 }}>About ten days of explaining and {petName} reaches its next form.</Sub>
            </Body>
            <Footer>
              <HoldButton
                label="Hold to commit"
                doneLabel="Promise made"
                accent={accent} // the promise fills with Glim's colour — the one coloured button
                onHoldStart={() => glim.current?.lookAt(0, 1)}
                onCancel={() => glim.current?.lookAt(0, 0)}
                onComplete={() => {
                  glim.current?.jump();
                  glim.current?.happy(1600);
                  setTimeout(finish, 1200);
                }}
              />
            </Footer>
          </>
        );
    }
  };

  return (
    <View style={st.root}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0C0B16', O.bg, O.bg]} style={StyleSheet.absoluteFill} />
      <Dust />

      {/* Step content */}
      <LayoutCtx.Provider value={{ below, baseBottom }}>
        <Animated.View key={step} entering={FadeIn.duration(320)} exiting={FadeOut.duration(180)} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {renderStep()}
        </Animated.View>
      </LayoutCtx.Provider>

      {/* Tap-anywhere layer for narrative steps — above the text, below Glim so Glim stays pokeable */}
      {TAP_STEPS.includes(step) && <Pressable style={StyleSheet.absoluteFill} onPress={tapNext} />}

      {!TAP_STEPS.includes(step) && (
        <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0 }}>
          <TopBar progress={progress} accent={accent} onBack={NO_BACK.includes(step) ? undefined : back} />
        </View>
      )}

      <AuthModal
        visible={showAuth}
        reason="restore"
        onDismiss={() => { setShowAuth(false); setRestoring(false); }}
        onAuthSuccess={() => setShowAuth(false)}
      />

      {/* Glim — one instance for the whole flow, so it glides between poses */}
      <Animated.View pointerEvents="box-none" style={[st.glim, { left: (width - GLIM_SIZE) / 2 }, glimStyle]}>
        <Glim ref={glim} size={GLIM_SIZE} stage={stage} mood={mood} droop={droop} palette={palette} />
      </Animated.View>
    </View>
  );
}

// ── Reveal (its own component so the count-up hook can live here) ─────────────
function RevealStep({
  hours, petName, onNext, onCounted,
}: {
  hours: number; petName: string; onNext: () => void; onCounted: () => void;
}) {
  const days = Math.round((hours * 365) / 24);
  const [go, setGo] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setGo(true), 450);
    const b = setTimeout(onCounted, 450 + 1500);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  const n = useCountUp(days, 1400, go);
  return (
    <>
      <Body>
        <Sub delay={100} style={{ color: O.sub }}>That’s</Sub>
        <View style={[st.bigRow, { marginTop: 0 }]}>
          <Text style={st.big}>{n}</Text>
          <Text style={st.bigUnit}> days</Text>
        </View>
        <Caption text="a year, gone to the scroll." delay={1700} size={24} />
        <Sub delay={2500} style={{ marginTop: 12 }}>What if just 10 minutes a day fed {petName} instead?</Sub>
      </Body>
      <Footer><GlowButton label="Let’s do it" onPress={onNext} /></Footer>
    </>
  );
}

// ── Teach Glim (demo) ─────────────────────────────────────────────────────────
// Read one fact, explain it out loud, Glim absorbs it. Graded by a cheap AI
// model (server, rate-limited) with the on-device grader as fallback.
// It's a taste, not a test: no score, one retry with a hint, and it always
// ends with Glim learning something.
type TeachPhase = 'read' | 'explain' | 'judging' | 'result';
type Verdict = 'great' | 'good' | 'retry';
// Voice is transcribed, then judged: allow a little longer than a text-only check.
const DEMO_TIMEOUT_MS = 12000;

function TeachStep({
  factId, petName, accent, glim, onLearned, onDone,
}: {
  factId: string; petName: string; accent: string;
  glim: React.RefObject<GlimHandle | null>;
  /** Glim absorbed the fact → it evolves from Spark to Glow on screen. */
  onLearned: () => void;
  onDone: () => void;
}) {
  const fact = DEMO_FACTS[factId] ?? DEMO_FACTS.science;
  const deviceId = useAppStore((s) => s.deviceId);
  const gradeDemo = useAction(api.pathsAi.gradeDemo);
  const [phase, setPhase] = useState<TeachPhase>('read');
  const [attempt, setAttempt] = useState(1);
  const [result, setResult] = useState<{ verdict: Verdict; feedback: string; hint: string | null } | null>(null);

  const judge = async (e: Explanation): Promise<{ verdict: Verdict; feedback: string; hint: string | null; noSpeech?: boolean }> => {
    try {
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), DEMO_TIMEOUT_MS));
      const call = gradeDemo({
        factId, deviceId,
        ...(e.kind === 'audio'
          ? { audio: { base64: e.base64, mimeType: e.mimeType, durationMs: e.durationMs } }
          : { transcript: e.text }),
      });
      return await Promise.race([call, timeout]);
    } catch {
      // Offline, slow, or rate-limited: no keyword guessing — the demo is a
      // taste, not a test, so Glim simply takes it in.
      return { verdict: 'good', feedback: `${petName} soaked that up. You’ll get detailed feedback on every quest.`, hint: fact.keyIdeas[0] };
    }
  };

  const [heardNothing, setHeardNothing] = useState(false);
  const [take, setTake] = useState(0); // remounts the recorder after a silent take
  const onExplained = async (e: Explanation) => {
    setPhase('judging');
    setHeardNothing(false);
    glim.current?.lookAt(0, 0.3);
    const r = await judge(e);
    // Silence doesn't count as an attempt: straight back to the mic.
    if (r.noSpeech) { setHeardNothing(true); setTake((t) => t + 1); setPhase('explain'); return; }
    // Second try always lands: Glim picks up the gist either way.
    const final = r.verdict === 'retry' && attempt >= 2
      ? { verdict: 'good' as Verdict, feedback: `${petName} picked up the gist — and you’ll get sharper every day.`, hint: r.hint }
      : r;
    setResult(final);
    setPhase('result');
    if (final.verdict === 'retry') {
      glim.current?.no();
    } else {
      glim.current?.absorb();
      glim.current?.happy(1800);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // evolve right as it swallows the fact
      setTimeout(onLearned, 250);
    }
  };

  const retry = () => { setAttempt((a) => a + 1); setResult(null); setPhase('explain'); };

  if (phase === 'read') {
    return (
      <>
        <Body scroll>
          <Sub delay={100} style={{ color: O.sub, fontFamily: F.semi, fontSize: 14 }}>{petName}’s first lesson</Sub>
          <Caption text={fact.title} delay={250} size={26} style={{ marginTop: 10 }} />
          <Animated.Text entering={FadeIn.delay(700).duration(500)} style={[st.factBody, { textAlign: 'center' }]}>
            {fact.body}
          </Animated.Text>
          <Sub delay={1300} style={{ marginTop: 18, fontSize: 14 }}>Read it once. Next, you’ll teach it to {petName} out loud.</Sub>
        </Body>
        <Footer><GlowButton label={`Teach it to ${petName}`} onPress={() => { glim.current?.nod(); setPhase('explain'); }} /></Footer>
      </>
    );
  }

  if (phase === 'explain') {
    return (
      <>
        <Body scroll>
          <Caption text={attempt > 1 ? 'One more go, in your own words.' : `Now explain it to ${petName}.`} size={24} />
          <Sub delay={250} style={{ marginTop: 8 }}>Like you’re telling a friend. Rough is fine.</Sub>
          {/* what you're explaining, so nobody has to remember it */}
          <Animated.View entering={FadeIn.delay(350).duration(400)} style={st.reminder}>
            <Text style={[st.reminderLabel, { color: O.sub }]}>
              {attempt > 1 && result?.hint ? 'Make sure you mention' : 'You’re explaining'}
            </Text>
            <Text style={st.reminderText}>{attempt > 1 && result?.hint ? result.hint : fact.title}</Text>
          </Animated.View>
          {heardNothing && <Sub delay={0} style={{ marginBottom: 6 }}>{petName} didn’t hear you — that one doesn’t count.</Sub>}
          <VoiceExplain
            key={`${attempt}-${take}`}
            accent={accent}
            rule={null}
            onStart={() => glim.current?.lookAt(0, 0.4)}
            onDone={onExplained}
          />
        </Body>
        <Footer>
          <GlowButton variant="ghost" label="Skip for now" onPress={onDone} />
        </Footer>
      </>
    );
  }

  if (phase === 'judging') {
    return (
      <Body>
        <Caption text={`${petName} is thinking it over…`} size={24} />
      </Body>
    );
  }

  // result
  const r = result!;
  const retrying = r.verdict === 'retry';
  return (
    <>
      <Body>
        <Caption
          text={retrying ? `Hmm, ${petName} didn’t quite catch it.` : `${r.verdict === 'great' ? `${petName} got it` : `${petName} learned something new`} — and evolved into Glow!`}
          size={26}
        />
        <Sub delay={300} style={{ marginTop: 10 }}>{r.feedback}</Sub>
        {r.hint && (
          <Animated.View entering={FadeIn.delay(600).duration(400)} style={[st.howRow, { marginTop: 20 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[st.howSub, { marginTop: 0 }]}>{retrying ? 'The key idea' : 'Next time, add'}</Text>
              <Text style={st.howTitle}>{r.hint}</Text>
            </View>
          </Animated.View>
        )}
      </Body>
      <Footer>
        {retrying ? (
          <>
            <GlowButton label="Try again" onPress={retry} />
            <GlowButton variant="ghost" label="Skip for now" onPress={onDone} style={{ marginTop: 4 }} />
          </>
        ) : (
          <GlowButton label="Continue" onPress={onDone} />
        )}
      </Footer>
    </>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: O.bg },
  glim: { position: 'absolute', top: 0 },
  body: { position: 'absolute', left: 24, right: 24 },
  footer: { position: 'absolute', left: 24, right: 24, alignItems: 'stretch' },
  nameInput: {
    marginTop: 28, color: O.text, fontFamily: F.black, fontSize: 36, letterSpacing: -1, textAlign: 'center',
    borderBottomWidth: 1.5, borderBottomColor: O.faint, paddingVertical: 10,
  },
  bigRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginTop: 18 },
  big: { color: O.text, fontFamily: F.black, fontSize: 80, lineHeight: 84, letterSpacing: -3, fontVariant: ['tabular-nums'] },
  bigUnit: { color: O.sub, fontFamily: F.black, fontSize: 28, marginBottom: 12, marginLeft: 2 },
  moodLine: { color: O.sub, fontFamily: F.bold, fontSize: 15, textAlign: 'center', marginTop: 2, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  tagText: { fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 11, letterSpacing: 1.2 },
  factBody: { color: '#C9C7D6', fontFamily: F.regular, fontSize: 17, lineHeight: 26, marginTop: 14 },
  explainCard: {
    marginTop: 18, borderRadius: 20, borderWidth: 1.5, borderColor: O.cardBorder,
    backgroundColor: O.card, padding: 16, minHeight: 120,
  },
  explainInput: { color: O.text, fontFamily: F.semi, fontSize: 17, lineHeight: 24, minHeight: 90, textAlignVertical: 'top' },
  xpPill: {
    alignSelf: 'center', borderWidth: 1.5, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 7, marginBottom: 16,
  },
  xpText: { color: O.text, fontFamily: F.black, fontSize: 15 },
  stagesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 },
  stageCell: { alignItems: 'center', width: 60 },
  stageRing: {
    width: 60, height: 66, borderRadius: 18, borderWidth: 1.5, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', backgroundColor: O.card,
  },
  stageName: { color: O.sub, fontFamily: F.bold, fontSize: 12, marginTop: 8 },
  readHint: { color: O.sub, fontFamily: F.semi, fontSize: 14, marginTop: 18 },
  reminder: {
    marginTop: 18, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: O.cardBorder,
    backgroundColor: O.card, paddingHorizontal: 16, paddingVertical: 12, gap: 3,
  },
  reminderLabel: { fontFamily: F.semi, fontSize: 12 },
  reminderText: { color: O.text, fontFamily: F.bold, fontSize: 16, lineHeight: 22 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: O.card, borderRadius: 18, borderWidth: 1, borderColor: O.cardBorder, padding: 14 },
  howTitle: { color: O.text, fontFamily: F.black, fontSize: 16 },
  howSub: { color: O.sub, fontFamily: F.regular, fontSize: 14, lineHeight: 20, marginTop: 2 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { color: '#C9C7D6', fontFamily: F.bold, fontSize: 14 },
  barValue: { color: O.text, fontFamily: F.black, fontSize: 14 },
  feedback: { color: '#C9C7D6', fontFamily: F.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 18 },
  xpTrack: { height: 8, borderRadius: 4, backgroundColor: '#1A1922', overflow: 'hidden' },
  xpFill: { height: 8, borderRadius: 4 },
  xpCaption: { color: O.sub, fontFamily: F.bold, fontSize: 13, textAlign: 'center', marginTop: 10 },
});
