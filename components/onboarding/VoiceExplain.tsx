import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { F, GlowButton, O, alpha } from './ui';

/** One minute per take: a clear explanation fits in 30–60 s, and ~350 KB uploads fast. */
const LIMIT = 60; // seconds
/** Countdown turns into a gentle warning (and ticks) for the last few seconds. */
const WARN_AT = 10;
const MAX_TAKES = 3;
const WARN = '#F5B860';

type Mode = 'idle' | 'rec' | 'saving' | 'review' | 'sending' | 'typing';
type Take = { uri: string; durationMs: number };

/** What the learner gave us: their voice (Gemini listens to it) or typed text. */
export type Explanation =
  | { kind: 'audio'; base64: string; mimeType: string; durationMs: number }
  | { kind: 'text'; text: string };

// Small, speech-friendly recording: mono AAC (.m4a), ~1 min ≈ 350 KB.
const RECORDING = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  numberOfChannels: 1,
  sampleRate: 22050,
  bitRate: 48000,
};
/** Loudness (dB) that counts as someone speaking, and how much speech we need. */
const VOICE_DB = -42;
const MIN_VOICED_MS = 700;
const MIN_TAKE_MS = 1500;

/**
 * Voice explanation: up to 3 takes of 1 minute each. After each take you can
 * listen back, then submit it or re-record; nothing is sent until you submit
 * (the server has Gemini transcribe + grade it). Cancelling mid-take and takes
 * where we never hear a voice don't count.
 */
export function VoiceExplain({
  accent, onStart, onVolume, onDone, rule = 'Up to 3 takes · 1 minute each',
}: {
  accent: string;
  /** Pill shown above the mic; null hides it (e.g. the forgiving onboarding demo). */
  rule?: string | null;
  onStart?: () => void;
  /** 0..1 loudness, ~12×/s while recording */
  onVolume?: (v: number) => void;
  onDone: (explanation: Explanation) => void;
}) {
  const [mode, setMode] = useState<Mode>('idle');
  const [note, setNote] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const emptyTakes = useRef(0);
  const [takesUsed, setTakesUsed] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const cancelled = useRef(false);
  // live "can it hear me?" feedback while recording
  const lastVoiceAt = useRef(0);
  const recStartedAt = useRef(0);
  const [hearing, setHearing] = useState<'waiting' | 'yes' | 'pause' | 'nothing'>('waiting');
  const voicedMs = useRef(0);
  const lastTick = useRef(0);
  const done = useRef(false);

  const recorder = useAudioRecorder(RECORDING);
  const rec = useAudioRecorderState(recorder, 80);
  const secs = Math.floor((rec.durationMillis ?? 0) / 1000);
  const left = Math.max(0, LIMIT - secs);
  const warning = mode === 'rec' && left <= WARN_AT;

  // a soft tick each second of the final countdown
  useEffect(() => {
    if (warning && left > 0) Haptics.selectionAsync().catch(() => {});
  }, [warning, left]);

  const vol = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      try { if (recorder.isRecording) recorder.stop(); } catch {}
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, []);

  // Live loudness → rings, and count how long we've actually heard a voice.
  useEffect(() => {
    if (mode !== 'rec') return;
    const db = rec.metering ?? -160;
    const v = Math.max(0, Math.min(1, (db + 50) / 42));
    vol.value = withTiming(v, { duration: 90 });
    onVolume?.(v);
    const now = Date.now();
    if (lastTick.current && db > VOICE_DB) voicedMs.current += now - lastTick.current;
    lastTick.current = now;
    if (db > VOICE_DB) lastVoiceAt.current = now;
    const next = now - lastVoiceAt.current < 700 ? 'yes'
      : lastVoiceAt.current ? 'pause'
      : now - recStartedAt.current > 3000 ? 'nothing' : 'waiting';
    if (next !== hearing) setHearing(next);
    if ((rec.durationMillis ?? 0) >= LIMIT * 1000 && !cancelled.current) stop();
  }, [rec.metering, rec.durationMillis, mode]);

  const finish = (e: Explanation) => {
    if (done.current) return;
    done.current = true;
    onDone(e);
  };

  const start = async () => {
    setNote(null);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { setMode('typing'); setNote('No mic access — type it instead.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      voicedMs.current = 0;
      lastTick.current = 0;
      cancelled.current = false;
      lastVoiceAt.current = 0;
      recStartedAt.current = Date.now();
      setHearing('waiting');
      recorder.record();
      setMode('rec');
      onStart?.();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      setMode('typing');
      setNote('Couldn’t start the mic — type it instead.');
    }
  };

  const stop = async () => {
    if (mode !== 'rec') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMode('saving');
    const durationMs = rec.durationMillis ?? 0;
    try { await recorder.stop(); } catch {}
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    vol.value = withTiming(0);

    // Never keep a take where we didn't hear anyone — it doesn't count.
    if (durationMs < MIN_TAKE_MS || voicedMs.current < MIN_VOICED_MS || !recorder.uri) {
      emptyTakes.current += 1;
      setMode(take ? 'review' : 'idle');
      setNote(emptyTakes.current >= 2
        ? 'Still not hearing you. Check your mic, or type it instead.'
        : 'Didn’t hear you — that one doesn’t count.');
      return;
    }
    const t = { uri: recorder.uri, durationMs };
    setTake(t);
    setTakesUsed((n) => n + 1);
    setNote(null);
    setMode('review');
  };

  /** Throw this take away mid-recording — it doesn't use up a take. */
  const cancel = async () => {
    if (mode !== 'rec') return;
    cancelled.current = true;
    Haptics.selectionAsync().catch(() => {});
    try { await recorder.stop(); } catch {}
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    vol.value = withTiming(0);
    setNote(null);
    setMode(take ? 'review' : 'idle');
  };

  const submit = async () => {
    if (!take) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setMode('sending');
    try {
      const base64 = await new File(take.uri).base64();
      finish({ kind: 'audio', base64, mimeType: 'audio/mp4', durationMs: take.durationMs });
    } catch {
      setMode('review');
      setNote('Something went wrong saving that — try again.');
    }
  };

  // ── visuals ──
  const ring = (k: number) =>
    useAnimatedStyle(() => {
      const live = mode === 'rec';
      const base = live ? 1 + vol.value * (0.35 + k * 0.25) : 1 + breathe.value * 0.06 * (k + 1);
      return {
        transform: [{ scale: base + k * 0.18 }],
        opacity: live ? 0.5 - k * 0.15 + vol.value * 0.2 : 0.07 - k * 0.025,
      };
    });
  const ring0 = ring(0);
  const ring1 = ring(1);
  const press = useSharedValue(1);
  const btn = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  if (mode === 'typing') {
    const ok = typed.trim().split(/\s+/).length >= 3;
    return (
      <Animated.View entering={FadeIn}>
        {note && <Text style={s.note}>{note}</Text>}
        <View style={[s.typeCard, ok && { borderColor: alpha(accent, 0.7) }]}>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoFocus
            multiline
            placeholder="In my own words…"
            placeholderTextColor={O.faint}
            style={s.typeInput}
            selectionColor={accent}
          />
        </View>
        <GlowButton label="Submit — one try" disabled={!ok} onPress={() => finish({ kind: 'text', text: typed.trim() })} style={{ marginTop: 16 }} />
      </Animated.View>
    );
  }

  const clock = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  const takesLeft = MAX_TAKES - takesUsed;

  // ── a finished take: listen back, then submit or re-record ──
  if ((mode === 'review' || mode === 'sending') && take) {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: 'stretch' }}>
        <Text style={s.takeLabel}>Take {takesUsed} of {MAX_TAKES}</Text>
        <TakePlayer key={take.uri} take={take} accent={accent} paused={mode === 'sending'} label={clock(Math.max(1, Math.round(take.durationMs / 1000)))} />

        {note && <Animated.Text entering={FadeIn.duration(250)} style={s.note}>{note}</Animated.Text>}

        <GlowButton label="Submit this take" loading={mode === 'sending'} onPress={submit} style={{ marginTop: 18 }} />
        {takesLeft > 0 ? (
          <Pressable
            disabled={mode === 'sending'}
            onPress={() => { setNote(null); start(); }}
            style={({ pressed }) => [s.redo, { opacity: pressed || mode === 'sending' ? 0.6 : 1 }]}
          >
            <Ionicons name="refresh" size={15} color={O.sub} />
            <Text style={s.typeBtnText}>Re-record · {takesLeft} {takesLeft === 1 ? 'take' : 'takes'} left</Text>
          </Pressable>
        ) : (
          <Text style={[s.note, { color: O.sub }]}>That was your last take.</Text>
        )}
      </Animated.View>
    );
  }

  return (
    <View style={{ alignItems: 'center' }}>
      {mode === 'idle' && rule && (
        <Animated.View entering={FadeInDown.delay(300)} style={s.rule}>
          <Ionicons name="mic-outline" size={13} color={O.sub} />
          <Text style={s.ruleText}>{rule}</Text>
        </Animated.View>
      )}

      <View style={s.micWrap}>
        {/* idle: neutral rings; recording: the accent, pulsing with your voice */}
        <Animated.View style={[s.ring, { backgroundColor: mode === 'rec' ? (warning ? WARN : accent) : '#FFFFFF' }, ring1]} />
        <Animated.View style={[s.ring, { backgroundColor: mode === 'rec' ? (warning ? WARN : accent) : '#FFFFFF' }, ring0]} />
        <Animated.View style={btn}>
          <Pressable
            onPressIn={() => { press.value = withTiming(0.94, { duration: 90 }); }}
            onPressOut={() => { press.value = withTiming(1, { duration: 160 }); }}
            onPress={mode === 'rec' ? stop : mode === 'idle' ? start : undefined}
            disabled={mode === 'saving'}
            style={[s.mic, { backgroundColor: mode === 'idle' ? accent : O.text }]}
          >
            {mode === 'saving'
              ? <ActivityIndicator color={O.bg} />
              : mode === 'rec'
                ? <View style={s.stopSquare} />
                : <Ionicons name="mic" size={34} color={O.bg} />}
          </Pressable>
        </Animated.View>
      </View>

      {mode === 'rec' ? (
        <>
          <Text style={[s.countdown, warning && { color: WARN }]}>{clock(left)}</Text>
          <View style={s.hearRow}>
            <View style={[s.hearDot, {
              backgroundColor: hearing === 'yes' ? '#5BD69A' : hearing === 'nothing' ? WARN : O.faint,
            }]} />
            <Text style={[s.status, hearing === 'nothing' && { color: WARN }]}>
              {hearing === 'nothing' ? 'Not hearing anything yet — speak up'
                : warning ? 'Wrap it up…'
                : hearing === 'yes' ? 'Hearing you · tap to finish'
                : hearing === 'pause' ? 'Keep going · tap to finish'
                : 'Listening…'}
            </Text>
          </View>
          <Pressable onPress={cancel} hitSlop={8} style={({ pressed }) => [s.typeBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="close" size={15} color={O.sub} />
            <Text style={s.typeBtnText}>Cancel take</Text>
          </Pressable>
        </>
      ) : (
        <Text style={s.status}>{mode === 'saving' ? 'Saving…' : takesUsed > 0 ? `Tap to re-record · ${takesLeft} left` : 'Tap and start talking'}</Text>
      )}

      {note && mode === 'idle' && (
        <Animated.Text entering={FadeIn.duration(250)} style={s.note}>{note}</Animated.Text>
      )}

      {mode === 'idle' && takesUsed === 0 && (
        <Pressable
          hitSlop={8}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); setNote(null); setMode('typing'); }}
          style={({ pressed }) => [s.typeBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="create-outline" size={15} color={O.sub} />
          <Text style={s.typeBtnText}>Type instead</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Listen back to a finished take. The audio player only exists here — never
 * while recording, where it can take over the audio session and the mic
 * records silence.
 */
function TakePlayer({ take, accent, paused, label }: { take: Take; accent: string; paused: boolean; label: string }) {
  const player = useAudioPlayer({ uri: take.uri });
  const st = useAudioPlayerStatus(player);
  useEffect(() => { if (paused) try { player.pause(); } catch {} }, [paused]);
  const listen = () => {
    Haptics.selectionAsync().catch(() => {});
    try {
      if (st.playing) { player.pause(); return; }
      if (st.duration && st.currentTime >= st.duration - 0.05) player.seekTo(0);
      player.play();
    } catch {}
  };
  const pos = st.duration ? Math.min(1, st.currentTime / st.duration) : 0;
  return (
    <View style={s.takeCard}>
      <Pressable onPress={listen} hitSlop={8} style={[s.playBtn, { backgroundColor: accent }]} accessibilityLabel={st.playing ? 'Pause' : 'Listen back'}>
        <Ionicons name={st.playing ? 'pause' : 'play'} size={20} color={O.bg} style={!st.playing && { marginLeft: 2 }} />
      </Pressable>
      <View style={{ flex: 1, gap: 7 }}>
        <Text style={s.takeTitle}>{st.playing ? 'Playing…' : 'Listen back'}</Text>
        <View style={s.track}><View style={[s.fill, { width: `${pos * 100}%`, backgroundColor: accent }]} /></View>
      </View>
      <Text style={s.takeTime}>{label}</Text>
    </View>
  );
}

const MIC = 92;
const s = StyleSheet.create({
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  ruleText: { color: O.sub, fontFamily: F.semi, fontSize: 13 },
  micWrap: { width: MIC * 2, height: MIC * 1.75, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: MIC, height: MIC, borderRadius: MIC / 2 },
  mic: { width: MIC, height: MIC, borderRadius: MIC / 2, alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 28, height: 28, borderRadius: 7, backgroundColor: O.bg },
  status: { color: O.sub, fontFamily: 'SpaceGrotesk-Medium', fontSize: 14, letterSpacing: 0.5 },
  hearRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hearDot: { width: 8, height: 8, borderRadius: 4 },
  countdown: { color: O.text, fontFamily: F.black, fontSize: 34, letterSpacing: -0.5, fontVariant: ['tabular-nums'], marginBottom: 2 },
  takeLabel: { color: O.sub, fontFamily: F.semi, fontSize: 13, textAlign: 'center', marginBottom: 10 },
  takeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, borderWidth: 1, borderColor: O.cardBorder, backgroundColor: O.card, padding: 14,
  },
  playBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  takeTitle: { color: O.text, fontFamily: F.bold, fontSize: 15 },
  takeTime: { color: O.sub, fontFamily: 'SpaceGrotesk-Medium', fontSize: 14, fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: '#1D1C26', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  redo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14, paddingVertical: 10 },
  note: { color: '#C9C7D6', fontFamily: F.semi, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 14, paddingHorizontal: 12 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 20,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    borderWidth: 1, borderColor: O.cardBorder, backgroundColor: O.card,
  },
  typeBtnText: { color: O.sub, fontFamily: F.bold, fontSize: 14 },
  typeCard: {
    borderRadius: 20, borderWidth: 1.5, borderColor: O.cardBorder,
    backgroundColor: O.card, padding: 16, minHeight: 130,
  },
  typeInput: { color: O.text, fontFamily: F.semi, fontSize: 17, lineHeight: 24, minHeight: 100, textAlignVertical: 'top' },
});
