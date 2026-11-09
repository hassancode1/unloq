// Library → Paths: what you're following, plus a sheet to browse curated paths
// or create your own from anything ("Ibn Khaldun", "The Art of War", …).
import { Ionicons } from '@expo/vector-icons';
import { useAction, useConvexAuth, useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppColors } from '../../constants/Colors';
import { Spacing } from '../../constants/spacing';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { usePathCatalog, type PathSummary } from '../../lib/usePaths';
import { useAppStore } from '../../store/useAppStore';
import { useEntitlement } from '../../hooks/useEntitlement';
import { usePathStyles } from '../../lib/pathColors';
import { PaywallModal } from '../paywall/PaywallHost';
import { SigilTile } from './PathSigil';
import PathDetailSheet from './PathDetailSheet';


const SUGGESTIONS = ['Ibn Khaldun', 'The Ottoman Empire', 'The Art of War', 'Body language', 'Ancient Egypt', 'How AI works'];

interface Props {
  C: AppColors;
  F: any;
  fs: (n: number) => number;
  onRequireAuth: () => void;
}

/** `grid` = full Library tab; `row` = compact horizontal strip. */
export default function PathsSection({
  C, F, fs, onRequireAuth, layout = 'row', openBrowse = false, onBrowseOpened,
}: Props & {
  layout?: 'row' | 'grid';
  /** Open the browse / create sheet (e.g. from the + button), then call onBrowseOpened. */
  openBrowse?: boolean;
  onBrowseOpened?: () => void;
}) {
  const activePaths = useAppStore((s) => s.activePaths);
  const { byId, loading } = usePathCatalog();
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    if (!openBrowse) return;
    setSheet(true);
    onBrowseOpened?.();
  }, [openBrowse]);
  const [detail, setDetail] = useState<string | null>(null);
  const styleFor = usePathStyles();

  const following = Object.entries(activePaths)
    .map(([id, a]) => ({ path: byId.get(id), ...a }))
    .filter((x): x is { path: PathSummary; order: number; addedAt: number } => !!x.path)
    .sort((a, b) => b.addedAt - a.addedAt);

  return (
    <View style={{ gap: 10, marginBottom: Spacing.md }}>
      <View style={st.row}>
        <Text style={{ color: C.text, fontFamily: F.extraBold, fontSize: fs(18) }}>{layout === 'grid' ? 'Following' : 'Paths'}</Text>
        <Pressable onPress={() => { Haptics.selectionAsync(); setSheet(true); }} hitSlop={8} style={st.row}>
          <Text style={{ color: C.sub, fontFamily: F.semiBold, fontSize: fs(13) }}>Browse all</Text>
          <Ionicons name="chevron-forward" size={14} color={C.sub} />
        </Pressable>
      </View>

      {layout === 'grid' ? (
        // Full-width rows: room for long titles and a clear progress line.
        <View style={{ gap: 10 }}>
          {loading && <View style={[st.listRow, { backgroundColor: C.surface, borderColor: C.border, justifyContent: 'center' }]}><ActivityIndicator color={C.muted} /></View>}
          {following.map(({ path, order }, i) => {
            const look = styleFor(path);
            const color = look.accent;
            const done = Math.min(order, path.topicCount);
            const status = path.status === 'outlining' ? 'Building your path…'
              : done >= path.topicCount ? 'Completed' : `Day ${done + 1} of ${path.topicCount}`;
            return (
              <Animated.View key={path._id} entering={FadeInDown.delay(i * 40).duration(300)}>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setDetail(path._id); }}
                  style={({ pressed }) => [st.listRow, { backgroundColor: C.surface, borderColor: C.border, opacity: pressed ? 0.85 : 1 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {path.status === 'outlining'
                      ? <View style={st.icon}><ActivityIndicator size="small" color={color} /></View>
                      : <SigilTile style={look} bg={C.surfaceAlt} border={C.border} />}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={1} style={{ color: C.text, fontFamily: F.bold, fontSize: fs(15) }}>{path.title}</Text>
                      <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.semiBold, fontSize: fs(12) }}>{status}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.muted} />
                  </View>
                  <View style={[st.track, { backgroundColor: C.surfaceAlt }]}>
                    <View style={[st.fill, { width: `${path.topicCount ? Math.max(3, (done / path.topicCount) * 100) : 0}%`, backgroundColor: color }]} />
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setSheet(true); }}
            style={[st.listRow, st.newRow, { borderColor: C.borderStrong }]}
          >
            <Ionicons name="add" size={20} color={C.sub} />
            <Text style={{ color: C.sub, fontFamily: F.semiBold, fontSize: fs(14) }}>Learn something new</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
          {loading && <View style={[st.card, { backgroundColor: C.surface, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={C.muted} /></View>}
          {following.map(({ path, order }, i) => {
            const look = styleFor(path);
            const color = look.accent;
            const done = Math.min(order, path.topicCount);
            return (
              <Animated.View key={path._id} entering={FadeInDown.delay(i * 40).duration(300)}>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setDetail(path._id); }}
                  style={[st.card, { backgroundColor: C.surface, borderColor: C.border }]}
                >
                  <SigilTile style={look} bg={C.surfaceAlt} border={C.border} />
                  <Text numberOfLines={2} style={{ color: C.text, fontFamily: F.bold, fontSize: fs(15), lineHeight: fs(19) }}>{path.title}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={{ color: C.muted, fontFamily: F.semiBold, fontSize: fs(12) }}>
                    {done >= path.topicCount ? 'Completed' : `Day ${done + 1} of ${path.topicCount}`}
                  </Text>
                  <View style={[st.track, { backgroundColor: C.surfaceAlt }]}>
                    <View style={[st.fill, { width: `${path.topicCount ? (done / path.topicCount) * 100 : 0}%`, backgroundColor: color }]} />
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setSheet(true); }}
            style={[st.card, st.newCard, { borderColor: C.borderStrong }]}
          >
            <Ionicons name="add" size={22} color={C.sub} />
            <Text style={{ color: C.sub, fontFamily: F.semiBold, fontSize: fs(14), textAlign: 'center' }}>New path</Text>
          </Pressable>
        </ScrollView>
      )}

      <PathsSheet visible={sheet} onClose={() => setSheet(false)} C={C} F={F} fs={fs} onRequireAuth={onRequireAuth} />
      <PathDetailSheet pathId={detail} onClose={() => setDetail(null)} C={C} F={F} fs={fs} />
    </View>
  );
}

// ── Browse / create sheet ─────────────────────────────────────────────────────

function PathsSheet({ visible, onClose, C, F, fs, onRequireAuth }: Props & { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useConvexAuth();
  const { curated, mine } = usePathCatalog();
  const activePaths = useAppStore((s) => s.activePaths);
  const addPath = useAppStore((s) => s.addPath);
  const removePath = useAppStore((s) => s.removePath);
  const createPath = useAction(api.pathsAi.createPath);
  const deleteCustom = useMutation(api.paths.deleteCustomPath);
  const { isPremium, loading: proLoading } = useEntitlement();
  // Paywall inside this sheet (iOS can't stack sibling modals); resolves create().
  const [paywall, setPaywall] = useState<null | ((ok: boolean) => void)>(null);
  const askPro = () => new Promise<boolean>((resolve) => setPaywall(() => resolve));

  const [prompt, setPrompt] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const create = async (text = prompt) => {
    if (!text.trim() || creating) return;
    if (!isAuthenticated) { onClose(); onRequireAuth(); return; }
    // Building a path is AI work, so it's part of Pro.
    if (!isPremium && !proLoading && !(await askPro())) return;
    setCreating(true);
    setError(null);
    try {
      const { pathId } = await createPath({ prompt: text.trim() });
      addPath(pathId);
      setPrompt('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      const msg = String(e?.data ?? e?.message ?? 'Something went wrong').replace(/^.*Uncaught Error: /, '').split('\n')[0];
      setError(msg.includes('PRO_REQUIRED') ? 'Creating your own paths is part of Pro.' : msg);
    } finally {
      setCreating(false);
    }
  };

  const toggle = (p: PathSummary) => {
    Haptics.selectionAsync();
    if (activePaths[p._id]) removePath(p._id); else addPath(p._id);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[st.row, { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm }]}>
          <Text style={{ color: C.text, fontFamily: F.extraBold, fontSize: fs(26), letterSpacing: -0.6 }}>Paths</Text>
          <Pressable onPress={onClose} hitSlop={10} style={[st.close, { backgroundColor: C.surface }]}>
            <Ionicons name="close" size={20} color={C.sub} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl, gap: Spacing.lg }}>
          {/* create */}
          <View style={[st.create, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={{ color: C.text, fontFamily: F.bold, fontSize: fs(16) }}>Learn anything</Text>
            <Text style={{ color: C.sub, fontFamily: F.regular, fontSize: fs(13), marginTop: -4 }}>
              A person, a book, an era, an idea. We’ll build a path that goes deeper every day.
            </Text>
            <View style={[st.input, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder="e.g. Al-Ghazali"
                placeholderTextColor={C.muted}
                style={{ flex: 1, color: C.text, fontFamily: F.regular, fontSize: fs(15), paddingVertical: 0 }}
                returnKeyType="go"
                onSubmitEditing={() => create()}
                editable={!creating}
                selectionColor={C.primary}
              />
              <Pressable
                onPress={() => create()}
                disabled={!prompt.trim() || creating}
                style={[st.go, { backgroundColor: C.text, opacity: !prompt.trim() || creating ? 0.35 : 1 }]}
              >
                {creating ? <ActivityIndicator size="small" color={C.bg} /> : <Ionicons name="arrow-up" size={18} color={C.bg} />}
              </Pressable>
            </View>
            {creating && <Text style={{ color: C.sub, fontFamily: F.regular, fontSize: fs(13) }}>Designing your path… this takes a few seconds.</Text>}
            {error && <Text style={{ color: C.error, fontFamily: F.regular, fontSize: fs(13) }}>{error}</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTIONS.map((sug) => (
                <Pressable key={sug} onPress={() => setPrompt(sug)} style={[st.chip, { borderColor: C.border }]}>
                  <Text style={{ color: C.sub, fontFamily: F.semiBold, fontSize: fs(12) }}>{sug}</Text>
                </Pressable>
              ))}
            </View>
            {!isAuthenticated ? (
              <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: fs(12) }}>You’ll need to sign in to create your own paths.</Text>
            ) : !isPremium && !proLoading ? (
              <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: fs(12) }}>Creating your own paths is part of Pro · 3 days free.</Text>
            ) : null}
          </View>

          {mine.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={[st.label, { color: C.muted, fontFamily: F.semiBold }]}>Made by you</Text>
              {mine.map((p) => (
                <PathRow key={p._id} p={p} following={!!activePaths[p._id]} onToggle={() => toggle(p)}
                  onOpen={() => setDetail(p._id)}
                  onDelete={() => { removePath(p._id); deleteCustom({ pathId: p._id as Id<'paths'> }).catch(() => {}); }}
                  C={C} F={F} fs={fs} />
              ))}
            </View>
          )}

          {curated.some((p) => p.trending) && (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="trending-up" size={14} color={C.muted} />
                <Text style={[st.label, { color: C.muted, fontFamily: F.semiBold }]}>Trending</Text>
              </View>
              {curated.filter((p) => p.trending).map((p, i) => (
                <Animated.View key={p._id} entering={FadeIn.delay(i * 30).duration(260)}>
                  <PathRow p={p} following={!!activePaths[p._id]} onToggle={() => toggle(p)} onOpen={() => setDetail(p._id)} C={C} F={F} fs={fs} />
                </Animated.View>
              ))}
            </View>
          )}

          <View style={{ gap: 10 }}>
            <Text style={[st.label, { color: C.muted, fontFamily: F.semiBold }]}>Curated</Text>
            {curated.filter((p) => !p.trending).map((p, i) => (
              <Animated.View key={p._id} entering={FadeIn.delay(i * 30).duration(260)}>
                <PathRow p={p} following={!!activePaths[p._id]} onToggle={() => toggle(p)} onOpen={() => setDetail(p._id)} C={C} F={F} fs={fs} />
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <PathDetailSheet pathId={detail} onClose={() => setDetail(null)} C={C} F={F} fs={fs} />
      <PaywallModal
        visible={!!paywall}
        onClose={() => { paywall?.(false); setPaywall(null); }}
        onUnlocked={() => { paywall?.(true); setPaywall(null); }}
      />
    </Modal>
  );
}

function PathRow({ p, following, onToggle, onOpen, onDelete, C, F, fs }: {
  p: PathSummary; following: boolean; onToggle: () => void; onOpen: () => void; onDelete?: () => void;
  C: AppColors; F: any; fs: (n: number) => number;
}) {
  const look = usePathStyles()(p);
  const color = look.accent;
  const busy = p.status === 'outlining';
  const failed = p.status === 'error';
  return (
    <Pressable
      onPress={() => { if (busy || failed) return; Haptics.selectionAsync(); onOpen(); }}
      style={({ pressed }) => [st.pathRow, { backgroundColor: C.surface, borderColor: C.border, opacity: pressed ? 0.85 : 1 }]}
    >
      {busy
        ? <View style={st.icon}><ActivityIndicator size="small" color={color} /></View>
        : <SigilTile style={look} bg={C.surfaceAlt} border={C.border} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: C.text, fontFamily: F.bold, fontSize: fs(15) }}>{p.title}</Text>
        <Text numberOfLines={2} style={{ color: failed ? C.error : C.sub, fontFamily: F.regular, fontSize: fs(12), lineHeight: fs(16) }}>
          {busy ? 'Building your path…' : failed ? p.subtitle : `${p.topicCount} days · ${p.subtitle}`}
        </Text>
      </View>
      {failed && onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8}><Ionicons name="trash-outline" size={18} color={C.muted} /></Pressable>
      ) : (
        <Pressable
          onPress={onToggle}
          disabled={busy}
          onLongPress={onDelete}
          style={[st.follow, following ? { backgroundColor: C.surfaceAlt, borderColor: C.border } : { backgroundColor: C.text, borderColor: C.text }]}
        >
          <Text style={{ color: following ? C.sub : C.bg, fontFamily: F.bold, fontSize: fs(12) }}>{following ? 'Following' : 'Follow'}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  card: { width: 150, height: 150, borderRadius: 20, borderWidth: 1, padding: 14, gap: 8 },
  listRow: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  newRow: { borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  newCard: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', width: 110 },
  icon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  create: { borderRadius: 22, borderWidth: 1, padding: 18, gap: 12 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, paddingLeft: 14, paddingRight: 6, height: 50 },
  go: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  label: { fontSize: 12, letterSpacing: 0.3 },
  pathRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  follow: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
});
