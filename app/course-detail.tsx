import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';
import type { AppColors } from '../constants/Colors';

type Props = {
  courseId: Id<'courses'>;
  onBack: () => void;
  onOpenFlashcards: () => void;
  onOpenQuiz: () => void;
  onOpenDiagram: () => void;
  onOpenPdf?: (url: string, title: string) => void;
};

function topicEmoji(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('math') || t.includes('calculus')) return '📐';
  if (t.includes('history')) return '🏛️';
  if (t.includes('science') || t.includes('physics') || t.includes('chem')) return '⚗️';
  if (t.includes('biology') || t.includes('bio')) return '🧬';
  if (t.includes('english') || t.includes('writing')) return '✍️';
  if (t.includes('code') || t.includes('program')) return '💻';
  if (t.includes('law') || t.includes('legal') || t.includes('bar')) return '⚖️';
  if (t.includes('finance') || t.includes('econ')) return '📈';
  if (t.includes('islam') || t.includes('quran') || t.includes('muslim')) return '☪️';
  return '📚';
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ C, onBack }: { C: AppColors; onBack: () => void }) {
  const op = useSharedValue(0.4);
  useEffect(() => {
    op.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const shimStyle = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <View style={[S.root, { backgroundColor: C.bg }]}>
      <View style={[S.headerBar, { borderBottomColor: C.border }]}>
        <TouchableOpacity style={[S.iconBtn, { backgroundColor: C.surfaceAlt }]} onPress={onBack}>
          <Ionicons name="arrow-back" size={19} color={C.muted} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: 14 }}>
        <Animated.View style={[{ height: 34, borderRadius: 8, backgroundColor: C.borderStrong, width: '80%' }, shimStyle]} />
        <Animated.View style={[{ height: 16, borderRadius: 6, backgroundColor: C.borderStrong, width: '45%' }, shimStyle]} />
        {[1, 2, 3].map(i => (
          <Animated.View key={i} style={[{ height: 72, borderRadius: 14, backgroundColor: C.borderStrong }, shimStyle]} />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Feature tile (Duo-style shadow + custom icon) ────────────────────────────

function Tile({ icon, label, sublabel, bg, color, border, shadow, onPress, disabled, loading, C }: {
  icon: string; label: string; sublabel?: string;
  bg: string; color: string; border: string; shadow: string;
  onPress?: () => void; disabled?: boolean; loading?: boolean; C: AppColors;
}) {
  return (
    <View style={[T.wrap, { opacity: disabled ? 0.42 : 1 }]}>
      <View style={[T.shadow, { backgroundColor: shadow, borderRadius: 14 }]} />
      <TouchableOpacity
        style={[T.tile, { backgroundColor: bg, borderColor: border }]}
        onPress={disabled ? undefined : onPress}
        activeOpacity={disabled ? 1 : 0.82}
      >
        <View style={[T.iconCircle, { backgroundColor: color + '28' }]}>
          {loading
            ? <Ionicons name="sync-outline" size={20} color={color} />
            : <Ionicons name={icon as any} size={20} color={color} />}
        </View>
        <View style={T.textCol}>
          <Text style={[T.label, { color }]} numberOfLines={1}>{label}</Text>
          {sublabel ? <Text style={[T.sublabel, { color: C.muted }]} numberOfLines={1}>{sublabel}</Text> : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const T = StyleSheet.create({
  wrap:       { flex: 1, marginBottom: 4 },
  shadow:     { position: 'absolute', bottom: -4, left: 0, right: 0, top: 0 },
  tile:       { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, transform: [{ translateY: -4 }] },
  iconCircle: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  textCol:    { flex: 1 },
  label:      { fontSize: 14, fontFamily: 'Nunito-Bold' },
  sublabel:   { fontSize: 11, fontFamily: 'Nunito-Regular', marginTop: 2 },
});

// ── Section header ────────────────────────────────────────────────────────────

function SectionHead({ label, C }: { label: string; C: AppColors }) {
  return <Text style={[SH.label, { color: C.text }]}>{label}</Text>;
}
const SH = StyleSheet.create({ label: { fontSize: 18, fontFamily: 'Nunito-Bold' } });

// ── Folder modal ──────────────────────────────────────────────────────────────

function FolderModal({ visible, onClose, courseId, currentFolderId, C, F, fs }: {
  visible: boolean; onClose: () => void;
  courseId: Id<'courses'>; currentFolderId?: Id<'folders'>;
  C: AppColors; F: any; fs: (n: number) => number;
}) {
  const [newName, setNewName] = useState('');
  const folders = (useQuery(api.courses.listFolders) ?? []) as any[];
  const createFolder = useMutation(api.courses.createFolder);
  const addToFolder  = useMutation(api.courses.addToFolder);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const folderId = await createFolder({ name: newName.trim() });
    await addToFolder({ courseId, folderId: folderId as any });
    setNewName('');
    onClose();
  };

  const handleSelect = async (folderId: Id<'folders'> | undefined) => {
    Haptics.selectionAsync();
    await addToFolder({ courseId, folderId });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={FM.backdrop} onPress={onClose} />
      <View style={[FM.sheet, { backgroundColor: C.surface }]}>
        <View style={[FM.handle, { backgroundColor: C.border }]} />
        <Text style={[FM.title, { fontFamily: F.bold, color: C.text }]}>Add to Folder</Text>

        {currentFolderId && (
          <TouchableOpacity style={FM.removeRow} onPress={() => handleSelect(undefined)}>
            <Ionicons name="folder-open-outline" size={18} color={C.error} />
            <Text style={[FM.removeTxt, { color: C.error, fontFamily: F.semiBold }]}>Remove from folder</Text>
          </TouchableOpacity>
        )}

        {folders.map((f: any) => {
          const active = f._id === currentFolderId;
          return (
            <TouchableOpacity
              key={f._id}
              style={[FM.folderRow, { backgroundColor: C.surfaceAlt, borderColor: active ? C.primary : C.border }]}
              onPress={() => handleSelect(f._id)}
            >
              <Ionicons name="folder-outline" size={18} color={active ? C.primary : C.sub} />
              <Text style={[FM.folderName, { fontFamily: F.semiBold, color: active ? C.primary : C.sub, flex: 1 }]}>{f.name}</Text>
              {active && <Ionicons name="checkmark" size={16} color={C.primary} />}
            </TouchableOpacity>
          );
        })}

        <View style={FM.createRow}>
          <TextInput
            style={[FM.input, { backgroundColor: C.surfaceAlt, borderColor: C.border, color: C.text, fontFamily: F.regular }]}
            placeholder="New folder name…"
            placeholderTextColor={C.muted}
            value={newName}
            onChangeText={setNewName}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <TouchableOpacity
            style={[FM.createBtn, { backgroundColor: C.primary, opacity: newName.trim() ? 1 : 0.4 }]}
            onPress={handleCreate}
            disabled={!newName.trim()}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const FM = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, gap: 8 },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  title:      { fontSize: 17, marginBottom: 4 },
  removeRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4 },
  removeTxt:  { fontSize: 14 },
  folderRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  folderName: {},
  createRow:  { flexDirection: 'row', gap: 8, marginTop: 4 },
  input:      { flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  createBtn:  { width: 46, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CourseDetailScreen({
  courseId, onBack, onOpenFlashcards, onOpenQuiz, onOpenDiagram, onOpenPdf,
}: Props) {
  const insets = useSafeAreaInsets();
  const { C, fs, F, isDark } = useTheme();

  const course     = useQuery(api.courses.get, { courseId }) as any;
  const rawLessons = useQuery(api.courses.getLessons, { courseId });
  const lessons    = (rawLessons ?? []) as any[];
  const pdfUrl     = useQuery(api.courses.getPdfUrl, { courseId });

  const generateQuiz    = useAction(api.ai.generateQuizForCourse);
  const generateDiagram = useAction(api.ai.generateDiagramForCourse);

  const [showFolder, setShowFolder]             = useState(false);
  const [generatingQuiz, setGeneratingQuiz]     = useState(false);
  const [generatingDiagram, setGeneratingDiagram] = useState(false);
  const [quizReady, setQuizReady]               = useState(false);

  const isLoading    = course === undefined || rawLessons === undefined;
  const isGenerating = course?.status === 'generating';

  useEffect(() => {
    if (quizReady && allQuiz > 0) {
      setQuizReady(false);
      onOpenQuiz();
    }
  }, [quizReady, allQuiz]);

  const allCards   = lessons.reduce((n: number, l: any) => n + (l.flashcards?.length ?? 0), 0);
  const allQuiz    = lessons.reduce((n: number, l: any) => n + (l.quiz?.length ?? 0), 0);
  const hasDiagram = lessons.some((l: any) => l.diagram);

  const dateStr = course?._creationTime
    ? new Date(course._creationTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  const allContent = lessons.flatMap((l: any) =>
    (l.content ?? []).map((s: any) => ({ heading: s.heading, body: s.body }))
  );

  const handleGenerateQuiz = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGeneratingQuiz(true);
    try {
      await generateQuiz({ courseId });
      setQuizReady(true);
    } catch (err: any) {
      const msg = err?.data?.message ?? err?.message ?? '';
      Toast.show({ type: 'error', text1: 'Quiz generation failed', text2: msg || 'Try again', visibilityTime: 4000 });
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleGenerateDiagram = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGeneratingDiagram(true);
    try {
      await generateDiagram({ courseId });
      onOpenDiagram();
    } catch (err: any) {
      const msg = err?.data?.message ?? err?.message ?? '';
      Toast.show({ type: 'error', text1: 'Mind map generation failed', text2: msg || 'Try again', visibilityTime: 4000 });
    } finally {
      setGeneratingDiagram(false);
    }
  };

  if (isLoading) return <Skeleton C={C} onBack={onBack} />;

  // Tile color sets — hand-picked per mode with Duo shadow color
  const flash = isDark
    ? { bg: '#0D1F3C', color: '#60A5FA', border: '#1B3460', shadow: '#060E1E' }
    : { bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD', shadow: '#93C5FD' };
  const quiz = isDark
    ? { bg: '#2A0A14', color: '#FB7185', border: '#5A1525', shadow: '#150408' }
    : { bg: '#FFE4E6', color: '#BE123C', border: '#FCA5A5', shadow: '#FCA5A5' };
  const mindmap = isDark
    ? { bg: '#1C1200', color: '#FCD34D', border: '#3A2600', shadow: '#0E0900' }
    : { bg: '#FEF9C3', color: '#92400E', border: '#FDE68A', shadow: '#FDE68A' };
  const pdf = isDark
    ? { bg: '#041F1A', color: '#34D399', border: '#0A4035', shadow: '#020F0D' }
    : { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7', shadow: '#6EE7B7' };

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>

      {/* Header */}
      <View style={[S.headerBar, { borderBottomColor: C.border }]}>
        <TouchableOpacity
          style={[S.iconBtn, { backgroundColor: C.surfaceAlt }]}
          onPress={() => { Haptics.selectionAsync(); onBack(); }}
        >
          <Ionicons name="arrow-back" size={19} color={C.muted} />
        </TouchableOpacity>
        <Text style={[S.headerEmoji]}>{topicEmoji(course?.title ?? '')}</Text>
        <TouchableOpacity style={[S.iconBtn, { backgroundColor: C.surfaceAlt }]}>
          <Ionicons name="ellipsis-horizontal" size={18} color={C.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>

        {/* Title block */}
        <Animated.View entering={FadeInDown.duration(240)} style={{ gap: 10 }}>
          <Text style={[S.title, { color: C.text }]}>{course?.title}</Text>
          <View style={S.metaRow}>
            <Text style={[S.metaDate, { color: C.muted, fontFamily: F.regular }]}>{dateStr}</Text>
            <TouchableOpacity
              style={[S.folderChip, { backgroundColor: C.primaryBg, borderColor: C.primaryRing }]}
              onPress={() => { Haptics.selectionAsync(); setShowFolder(true); }}
              activeOpacity={0.8}
            >
              <Ionicons name="folder-outline" size={13} color={C.primary} />
              <Text style={[S.folderChipTxt, { color: C.primary, fontFamily: F.semiBold }]}>
                {course?.folderId ? 'In Folder' : 'Add to Folder'}
              </Text>
              <Ionicons name="chevron-down" size={11} color={C.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Memory Practice */}
        <Animated.View entering={FadeInDown.delay(50).duration(240)} style={S.section}>
          <SectionHead label="Memory Practice" C={C} />
          <View style={S.tileRow}>
            <Tile
              icon="albums-outline"
              label="Flashcards"
              sublabel={allCards > 0 ? `${allCards} cards` : 'None yet'}
              bg={flash.bg} color={flash.color} border={flash.border} shadow={flash.shadow}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenFlashcards(); }}
              disabled={allCards === 0}
              C={C}
            />
            <Tile
              icon="clipboard-outline"
              label="Quiz"
              sublabel={allQuiz > 0 ? `${allQuiz} questions` : 'Tap to generate'}
              bg={quiz.bg} color={quiz.color} border={quiz.border} shadow={quiz.shadow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (allQuiz > 0) onOpenQuiz(); else handleGenerateQuiz();
              }}
              disabled={generatingQuiz}
              loading={generatingQuiz}
              C={C}
            />
          </View>
        </Animated.View>

        {/* Visual */}
        <Animated.View entering={FadeInDown.delay(90).duration(240)} style={S.section}>
          <SectionHead label="Visual" C={C} />
          <View style={S.tileRow}>
            <Tile
              icon="git-network-outline"
              label="Mind Map"
              sublabel={generatingDiagram ? 'Generating…' : hasDiagram ? 'Tap to explore' : 'Tap to generate'}
              bg={mindmap.bg} color={mindmap.color} border={mindmap.border} shadow={mindmap.shadow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (hasDiagram) onOpenDiagram(); else handleGenerateDiagram();
              }}
              disabled={generatingDiagram}
              loading={generatingDiagram}
              C={C}
            />
            <Tile
              icon="document-text-outline"
              label="PDF Preview"
              sublabel={pdfUrl ? 'View source' : 'No PDF'}
              bg={pdfUrl ? pdf.bg : C.surfaceAlt}
              color={pdfUrl ? pdf.color : C.muted}
              border={pdfUrl ? pdf.border : C.border}
              shadow={pdfUrl ? pdf.shadow : C.border}
              onPress={pdfUrl ? () => { Haptics.selectionAsync(); onOpenPdf?.(pdfUrl, course?.title ?? 'PDF'); } : undefined}
              disabled={!pdfUrl}
              C={C}
            />
          </View>
        </Animated.View>

        {/* Actions — coming soon */}
        {/* <Animated.View entering={FadeInDown.delay(130).duration(240)} style={S.section}>
          <SectionHead label="Actions" icon="compass-outline" iconColor={C.primary} C={C} />
          <View style={{ gap: 8 }}>
            <Tile emoji="🌐" label="Translate"  sublabel="Coming soon" bg={purpleTileBg} color={C.primary} border={purpleBorder} disabled C={C} />
            <Tile emoji="✏️" label="Edit Notes" sublabel="Coming soon" bg={purpleTileBg} color={C.primary} border={purpleBorder} disabled C={C} />
          </View>
        </Animated.View> */}

        {/* Smart Notes */}
        <Animated.View entering={FadeInDown.delay(170).duration(240)} style={S.section}>
          <Text style={[SH.label, { color: C.text }]}>Smart Notes</Text>

          <View style={[S.notesCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[S.notesTitle, { color: C.primary, fontFamily: F.bold }]}>{course?.title}</Text>
            {course?.description ? (
              <Text style={[S.notesSub, { color: C.sub, fontFamily: F.regular }]}>{course.description}</Text>
            ) : null}
            {lessons[0]?.keyConcept ? (
              <Text style={[S.notesSub, { color: C.muted, fontFamily: F.regular, fontStyle: 'italic', marginTop: 2 }]}>
                {lessons[0].keyConcept}
              </Text>
            ) : null}

            <View style={[S.notesDivider, { backgroundColor: C.border }]} />

            {isGenerating && (
              <View style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
                <Text style={{ fontSize: 34 }}>⏳</Text>
                <Text style={[{ fontSize: 14, fontFamily: F.semiBold, color: C.muted }]}>Notes are being generated…</Text>
              </View>
            )}

            {!isGenerating && allContent.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
                <Text style={{ fontSize: 34 }}>📄</Text>
                <Text style={[{ fontSize: 14, fontFamily: F.semiBold, color: C.muted }]}>No notes yet</Text>
              </View>
            )}

            {allContent.map((s: any, i: number) => (
              <View key={i} style={i > 0 ? { marginTop: 16 } : undefined}>
                {s.heading ? (
                  <Text style={[S.notesHeading, { color: C.text, fontFamily: F.semiBold }]}>{s.heading}</Text>
                ) : null}
                <Text style={[S.notesBody, { color: C.sub, fontFamily: F.regular }]}>{s.body}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

      </ScrollView>

      {/* Sticky bottom bar — Duo-style shadow CTAs */}
      <View style={[S.bottomBar, { backgroundColor: C.bg, borderTopColor: C.border, paddingBottom: insets.bottom + 8 }]}>
        {/* Ask AI */}
        <View style={S.duoWrap}>
          <View style={[S.duoShadow, { backgroundColor: C.text }]} />
          <View style={[S.duoBtn, { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.text, transform: [{ translateY: -4 }] }]}>
            <Text style={{ fontSize: 18 }}>🐼</Text>
            <Text style={[S.duoBtnTxt, { fontFamily: F.bold, color: C.text }]}>Ask AI</Text>
            <View style={S.soonTag}><Text style={S.soonTagTxt}>Soon</Text></View>
          </View>
        </View>
        {/* Feynman */}
        <View style={S.duoWrap}>
          <View style={[S.duoShadow, { backgroundColor: C.text }]} />
          <View style={[S.duoBtn, { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.text, transform: [{ translateY: -4 }] }]}>
            <Text style={{ fontSize: 18 }}>🐷</Text>
            <Text style={[S.duoBtnTxt, { fontFamily: F.bold, color: C.text }]}>Feynman</Text>
            <View style={S.soonTag}><Text style={S.soonTagTxt}>Soon</Text></View>
          </View>
        </View>
      </View>

      <FolderModal
        visible={showFolder}
        onClose={() => setShowFolder(false)}
        courseId={courseId}
        currentFolderId={course?.folderId}
        C={C} F={F} fs={fs}
      />
    </View>
  );
}

const S = StyleSheet.create({
  root:       { flex: 1 },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn:     { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerEmoji: { fontSize: 20 },

  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.lg },

  title:       { fontSize: 26, fontFamily: 'Nunito-ExtraBold', lineHeight: 34 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  metaDate:    { fontSize: 12 },
  folderChip:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6 },
  folderChipTxt: { fontSize: 12 },

  section:      { gap: 10 },
  tileRow:      { flexDirection: 'row', gap: 10 },

  notesCard:    { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  notesTitle:   { fontSize: 18, lineHeight: 26, marginBottom: 6 },
  notesSub:     { fontSize: 13, lineHeight: 20 },
  notesDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  notesHeading: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  notesBody:    { fontSize: 13, lineHeight: 21 },

  bottomBar:    { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  bottomBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14 },
  bottomBtnTxt: { fontSize: 15 },

  duoWrap:   { flex: 1, borderRadius: 14, marginBottom: 4 },
  duoShadow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, borderRadius: 14 },
  duoBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14 },
  duoBtnTxt: { fontSize: 15, color: '#fff' },
  soonTag:   { position: 'absolute', top: -6, right: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  soonTagTxt:{ fontSize: 9, fontFamily: 'Nunito-Bold', color: '#fff', letterSpacing: 0.5 },
});
