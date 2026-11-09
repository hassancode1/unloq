// What a path actually contains: its days in order, what you've done,
// what's next, and follow / unfollow.
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppColors } from '../../constants/Colors';
import { Spacing } from '../../constants/spacing';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { dayKey } from '../../lib/quests';
import { useAppStore } from '../../store/useAppStore';
import { usePathStyles } from '../../lib/pathColors';
import { interestMeta } from '../../lib/quests';
import { makeSigil } from '../../lib/sigil';
import { alpha } from '../onboarding/ui';
import PathSigil from './PathSigil';

interface Props {
  pathId: string | null;
  onClose: () => void;
  C: AppColors;
  F: any;
  fs: (n: number) => number;
}

export default function PathDetailSheet({ pathId, onClose, C, F, fs }: Props) {
  const insets = useSafeAreaInsets();
  const path = useQuery(api.paths.getPath, pathId ? { pathId: pathId as Id<'paths'> } : 'skip');
  const active = useAppStore((s) => (pathId ? s.activePaths[pathId] : undefined));
  const doneToday = useAppStore((s) => !!s.questLog[dayKey()]);
  const addPath = useAppStore((s) => s.addPath);
  const removePath = useAppStore((s) => s.removePath);

  const [openId, setOpenId] = React.useState<string | null>(null);
  const following = !!active;
  const order = active?.order ?? 0;
  const styleFor = usePathStyles();
  const look = path ? styleFor(path) : null;
  const accent = look?.accent ?? '#A5B4FC';
  const total = path?.topics.length ?? 0;
  const done = Math.min(order, total);
  const finished = following && total > 0 && done >= total;

  // The mark assembles as you go. Following lights the first piece (you've
  // started); the rest light up across the days, whole on the last one.
  const tones = look ? makeSigil(look.sigil).map((p) => p.tone) : [0];
  const pieces = tones.length;
  const rest = Math.max(1, pieces - 1);
  const lit = total ? Math.min(pieces, 1 + Math.floor((done / total) * rest)) : 1;
  const nextPieceAt = Math.ceil((lit * total) / rest);
  const daysToNext = Math.max(1, nextPieceAt - done);
  /** The colour of the piece a day (0-based) builds toward. */
  const dayColor = (day: number) => {
    const k = Math.min(pieces - 1, 1 + Math.floor((day * rest) / Math.max(1, total)));
    return look ? look.duo[tones[k]] : accent;
  };

  const toggle = () => {
    if (!pathId) return;
    Haptics.selectionAsync();
    if (following) removePath(pathId); else addPath(pathId);
  };

  return (
    <Modal visible={!!pathId} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[st.top, { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }]}>
          <View />
          <Pressable onPress={onClose} hitSlop={10} style={[st.close, { backgroundColor: C.surface }]}>
            <Ionicons name="close" size={20} color={C.sub} />
          </Pressable>
        </View>

        {path === undefined ? (
          <View style={st.center}><ActivityIndicator color={C.muted} /></View>
        ) : path === null ? (
          <View style={st.center}>
            <Text style={{ color: C.sub, fontFamily: F.regular, fontSize: fs(14) }}>This path isn’t available anymore.</Text>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.lg }}>
              <View style={{ gap: 12 }}>
                <PathSigil key={path._id} style={look!} size={88} animate lit={following ? lit : undefined} />
                <Text style={{ color: C.muted, fontFamily: F.semiBold, fontSize: fs(12), marginTop: 6 }}>
                  {[path.trending ? 'Trending' : null, interestMeta(path.interest)?.label ?? (path.curated ? null : 'Made by you'), `${total} days`]
                    .filter(Boolean).join(' · ')}
                </Text>
                <Animated.Text
                  entering={FadeIn.delay(200).duration(400)}
                  style={{ color: C.text, fontFamily: F.extraBold, fontSize: fs(26), letterSpacing: -0.6, lineHeight: fs(31) }}
                >
                  {/* non-breaking hyphens: "fact-checked" shouldn't split across lines */}
                  {path.title.replace(/-/g, '\u2011')}
                </Animated.Text>
                <Animated.Text
                  entering={FadeIn.delay(280).duration(400)}
                  style={{ color: C.sub, fontFamily: F.regular, fontSize: fs(14), lineHeight: fs(20) }}
                >
                  {path.subtitle}
                </Animated.Text>
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Text style={{ color: C.muted, fontFamily: F.semiBold, fontSize: fs(12) }}>
                    {!following ? `One short topic a day · finish it to complete the mark`
                      : finished ? 'Mark complete — you finished this path'
                      : `${done} of ${total} days · next piece in ${daysToNext} ${daysToNext === 1 ? 'day' : 'days'}`}
                  </Text>
                  {following && (
                    // one segment per day, coloured by the piece of the mark it builds
                    <View style={st.segments}>
                      {Array.from({ length: total }, (_, d) => (
                        <View
                          key={d}
                          style={[
                            st.segment,
                            d < done ? { backgroundColor: dayColor(d) }
                              : d === done ? { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: dayColor(d) }
                              : { backgroundColor: C.surfaceAlt },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {(() => {
                const doneTopics = following ? path.topics.filter((t) => t.order < order) : [];
                const next = following ? path.topics.find((t) => t.order === order) : undefined;
                const upcoming = path.topics.filter((t) => !following || t.order > order);
                return (
                  <View style={{ gap: Spacing.lg }}>
                    {/* finished days: short, quiet, a check in their piece's colour */}
                    {doneTopics.length > 0 && (
                      <View style={{ gap: 2 }}>
                        {doneTopics.map((t) => (
                          <DayRow key={t._id} t={t} state="done" tint={dayColor(t.order)} open={openId === t._id}
                            onPress={() => setOpenId(openId === t._id ? null : t._id)} C={C} F={F} fs={fs} />
                        ))}
                      </View>
                    )}

                    {/* today: the one thing that matters on this page */}
                    {next && (
                      <Animated.View
                        entering={FadeIn.delay(120).duration(320)}
                        style={[st.nextCard, { backgroundColor: C.surface, borderColor: alpha(dayColor(next.order), 0.55) }]}
                      >
                        <View style={st.nextHead}>
                          <Text style={{ color: dayColor(next.order), fontFamily: F.semiBold, fontSize: fs(12) }}>
                            Day {next.order + 1} · {doneToday ? 'tomorrow' : 'today'}
                          </Text>
                          <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: fs(12) }}>~1 min read</Text>
                        </View>
                        <Text style={{ color: C.text, fontFamily: F.extraBold, fontSize: fs(20), lineHeight: fs(25), letterSpacing: -0.3 }}>
                          {next.title}
                        </Text>
                        <Text style={{ color: C.sub, fontFamily: F.regular, fontSize: fs(14), lineHeight: fs(20) }}>{next.summary}</Text>
                        <View style={[st.nextFoot, { borderTopColor: C.border }]}>
                          <Ionicons name="mic-outline" size={14} color={C.muted} />
                          <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: fs(12) }}>
                            Read it, then explain it out loud to grow Glim
                          </Text>
                        </View>
                      </Animated.View>
                    )}

                    {/* what's ahead: titles only, tap one to see what it covers */}
                    {upcoming.length > 0 && (
                      <View style={{ gap: 6 }}>
                        <Text style={{ color: C.muted, fontFamily: F.semiBold, fontSize: fs(13), marginBottom: 4 }}>
                          {following ? 'Coming up' : 'What you’ll learn'}
                        </Text>
                        <View style={[st.list, { borderColor: C.border, backgroundColor: C.surface }]}>
                          {upcoming.map((t, i) => (
                            <View key={t._id}>
                              {i > 0 && <View style={[st.hairline, { backgroundColor: C.border }]} />}
                              <DayRow t={t} state="upcoming" tint={dayColor(t.order)} open={openId === t._id}
                                onPress={() => setOpenId(openId === t._id ? null : t._id)} C={C} F={F} fs={fs} />
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })()}
            </ScrollView>

            <View style={[st.footer, { paddingBottom: insets.bottom + Spacing.md, borderTopColor: C.border, backgroundColor: C.bg }]}>
              {following ? (
                <Pressable onPress={toggle} style={[st.btn, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={{ color: C.sub, fontFamily: F.bold, fontSize: fs(15) }}>Stop following</Text>
                </Pressable>
              ) : (
                <Pressable onPress={toggle} style={[st.btn, { backgroundColor: C.text, borderColor: C.text }]}>
                  <Text style={{ color: C.bg, fontFamily: F.bold, fontSize: fs(15) }}>Follow this path</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

function DayRow({ t, state, tint, open, onPress, C, F, fs }: {
  t: { _id: string; order: number; title: string; summary: string };
  state: 'done' | 'upcoming';
  tint: string;
  open: boolean;
  onPress: () => void;
  C: AppColors; F: any; fs: (n: number) => number;
}) {
  const done = state === 'done';
  return (
    <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} style={st.row}>
      <View
        style={[
          st.num,
          done ? { backgroundColor: tint, borderColor: tint } : { backgroundColor: C.surfaceAlt, borderColor: C.border },
        ]}
      >
        {done
          ? <Ionicons name="checkmark" size={14} color={C.bg} />
          : <Text style={{ color: C.sub, fontFamily: F.extraBold, fontSize: fs(12) }}>{String(t.order + 1).padStart(2, '0')}</Text>}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: done ? C.sub : C.text, fontFamily: F.semiBold, fontSize: fs(15), lineHeight: fs(20) }}>{t.title}</Text>
        {open && (
          <Animated.Text
            entering={FadeIn.duration(220)}
            style={{ color: C.muted, fontFamily: F.regular, fontSize: fs(13), lineHeight: fs(18) }}
          >
            {t.summary}
          </Animated.Text>
        )}
      </View>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} style={{ marginTop: 2 }} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: Spacing.sm },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segments: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  nextCard: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 10 },
  nextHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  list: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  hairline: { height: 1, marginLeft: 58 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  num: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1 },
  btn: { height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
