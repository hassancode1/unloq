import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

import { useTheme } from '../hooks/useTheme';
import { useEntitlement } from '../hooks/useEntitlement';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppStore } from '../store/useAppStore';
import { Spacing } from '../constants/spacing';
import type { AppColors } from '../constants/Colors';
import UploadScreen from './upload';
import SettingsScreen from './settings';
import LessonPlayer from './lesson-player';
import CourseDetailScreen from './course-detail';
import PdfViewerScreen from './pdf-viewer';
import AuthModal, { type AuthReason } from './auth-modal';
import BottomTabBar, { type HomeTab } from '../components/BottomTabBar';
import CreateModal, { type CreateOptionKey } from '../components/CreateModal';
import { GUIDE_PREVIEW, NOTES_ENABLED } from '../lib/features';
import { openPaywall } from '../lib/pro';
import FeynmanScreen from './feynman';
import QuestScreen from './quest';
import TodayTab from '../components/today/TodayTab';
import PathsSection from '../components/paths/PathsSection';
import Glim from '../components/mascot/Glim';
import { paletteForInterests } from '../components/mascot/palettes';

// ── Helpers ──────────────────────────────────────────────────────────────────

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Quiet glyph + accent per subject. One accent per row, greyscale everywhere else. */
export function topicIcon(title: string): { icon: IconName; color: string } {
  const t = (title ?? '').toLowerCase();
  if (/math|calculus|algebra|geometr|statist/.test(t)) return { icon: 'calculator-outline', color: '#A78BFA' };
  if (/history|war|ancient/.test(t))                    return { icon: 'hourglass-outline', color: '#F5A65B' };
  if (/physics|chem|science/.test(t))                    return { icon: 'flask-outline', color: '#38BDF8' };
  if (/bio|anatomy|medic|health/.test(t))               return { icon: 'leaf-outline', color: '#34D399' };
  if (/english|writing|literat|essay/.test(t))          return { icon: 'create-outline', color: '#FB7185' };
  if (/code|program|software|computer/.test(t))         return { icon: 'code-slash-outline', color: '#818CF8' };
  if (/law|legal|\bbar\b|mbe|mee/.test(t))               return { icon: 'scale-outline', color: '#7DD3FC' };
  if (/finance|econ|money|account/.test(t))             return { icon: 'trending-up-outline', color: '#FACC15' };
  if (/psych|mind/.test(t))                              return { icon: 'happy-outline', color: '#F472B6' };
  return { icon: 'document-text-outline', color: '#8E8C9E' };
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ── Create folder sheet ───────────────────────────────────────────────────────

function CreateFolderSheet({ visible, onDismiss, onCreated, C, fs, F }: {
  visible: boolean; onDismiss: () => void; onCreated: (folderId: string) => void;
  C: AppColors; fs: (n: number) => number; F: any;
}) {
  const [name, setName] = useState('');
  const createFolder = useMutation(api.courses.createFolder);
  const MAX = 25;

  const handleCreate = async () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const folderId = await createFolder({ name: name.trim() });
    setName('');
    onCreated(folderId as string);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => { setName(''); onDismiss(); }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
          activeOpacity={1}
          onPress={() => { setName(''); onDismiss(); }}
        />
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={{ backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md }}
        >
          {/* Handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, alignSelf: 'center', marginBottom: 4 }} />

          {/* Header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.primaryBg, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="folder" size={20} color={C.primary} />
              </View>
              <Text style={{ fontFamily: F.extraBold, fontSize: fs(19), color: C.text }}>New folder</Text>
            </View>
            <TouchableOpacity onPress={() => { setName(''); onDismiss(); }} hitSlop={8}>
              <Text style={{ fontFamily: F.regular, fontSize: fs(15), color: C.muted }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Input */}
          <TextInput
            style={{
              borderRadius: 14, borderWidth: 1, borderColor: name.trim() ? C.primary : C.border,
              backgroundColor: C.surfaceAlt, paddingHorizontal: 16, paddingVertical: 16,
              fontFamily: F.regular, fontSize: fs(16), color: C.text,
            }}
            placeholder="Folder name"
            placeholderTextColor={C.muted}
            value={name}
            onChangeText={t => setName(t.slice(0, MAX))}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          {/* Create button */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={!name.trim()}
            activeOpacity={0.8}
            style={{
              borderRadius: 14, paddingVertical: 16,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              backgroundColor: name.trim() ? C.text : C.borderStrong,
            }}
          >
            <Ionicons name="folder-open" size={18} color={name.trim() ? C.bg : C.muted} />
            <Text style={{ fontFamily: F.bold, fontSize: fs(16), color: name.trim() ? C.bg : C.muted }}>Create folder</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Folder picker sheet ───────────────────────────────────────────────────────

function FolderPickerSheet({ visible, folders, activeFolderId, onSelect, onDismiss, onCreateFolder, C, fs, F }: {
  visible: boolean; folders: any[]; activeFolderId: string | null;
  onSelect: (id: string | null) => void; onDismiss: () => void; onCreateFolder: () => void;
  C: AppColors; fs: (n: number) => number; F: any;
}) {
  const deleteFolder = useMutation(api.courses.deleteFolder);
  const [folderContextMenu, setFolderContextMenu] = useState<any>(null);

  const handleDelete = (folder: any) => {
    Alert.alert(`Delete "${folder.name}"?`, 'Courses in this folder will move to All Notes.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteFolder({ folderId: folder._id });
          if (activeFolderId === folder._id) onSelect(null);
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (folderContextMenu) { setFolderContextMenu(null); } else { onDismiss(); }
      }}
    >
      {folderContextMenu ? (
        /* ── Context menu state: dark overlay + action sheet ── */
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFolderContextMenu(null)} />
          <Animated.View
            entering={FadeInDown.duration(220)}
            style={{ marginHorizontal: 14, marginBottom: 10, borderRadius: 20, overflow: 'hidden', backgroundColor: C.surface }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: C.primaryBg, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="folder" size={22} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.bold, fontSize: fs(14), color: C.text }} numberOfLines={1}>{folderContextMenu.name}</Text>
                <Text style={{ fontFamily: F.regular, fontSize: fs(11), color: C.muted }}>Folder</Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 }}
              onPress={() => {
                const folder = folderContextMenu;
                setFolderContextMenu(null);
                setTimeout(() => handleDelete(folder), 300);
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.errorBg, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="trash-outline" size={18} color={C.error} />
              </View>
              <Text style={{ fontFamily: F.semiBold, fontSize: fs(16), color: C.error }}>Delete folder</Text>
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity
            style={{ marginHorizontal: 14, marginBottom: 36, borderRadius: 16, paddingVertical: 16, alignItems: 'center', backgroundColor: C.surface }}
            activeOpacity={0.75}
            onPress={() => setFolderContextMenu(null)}
          >
            <Text style={{ fontFamily: F.bold, fontSize: fs(16), color: C.text }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Normal picker state ── */
        <>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={onDismiss} />
          <View style={[libStyles.pickerSheet, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }]}>
            <View style={[libStyles.pickerHandle, { backgroundColor: C.borderStrong }]} />
            {/* All Notes row */}
            <TouchableOpacity
              style={[libStyles.pickerRow, { borderBottomColor: C.border }]}
              onPress={() => { onSelect(null); onDismiss(); }}
              activeOpacity={0.7}
            >
              <Ionicons name="albums-outline" size={20} color={C.text} />
              <Text style={[libStyles.pickerRowTxt, { fontFamily: F.semiBold, fontSize: fs(15), color: C.text }]}>All notes</Text>
              {!activeFolderId && <Ionicons name="checkmark" size={18} color={C.text} />}
            </TouchableOpacity>
            {/* Folder rows — three-dot is a sibling touchable, not nested */}
            {folders.map((f: any) => (
              <View key={f._id} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 15 }}
                  onPress={() => { onSelect(f._id); onDismiss(); }}
                  onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFolderContextMenu(f); }}
                  delayLongPress={400}
                  activeOpacity={0.7}
                >
                  <Ionicons name="folder" size={20} color={C.primary} />
                  <Text style={[libStyles.pickerRowTxt, { fontFamily: F.semiBold, fontSize: fs(15), color: C.text }]} numberOfLines={1}>{f.name}</Text>
                  {activeFolderId === f._id && <Ionicons name="checkmark" size={18} color={C.text} />}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); setFolderContextMenu(f); }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={{ paddingHorizontal: Spacing.lg, paddingVertical: 15 }}
                >
                  <Ionicons name="ellipsis-vertical" size={17} color={C.muted} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[libStyles.pickerNewFolder, { borderTopColor: C.border }]}
              onPress={() => { onDismiss(); onCreateFolder(); }}
              activeOpacity={0.7}
            >
              <View style={[libStyles.pickerAddIcon, { backgroundColor: C.surfaceAlt }]}>
                <Ionicons name="add" size={18} color={C.text} />
              </View>
              <Text style={{ fontFamily: F.semiBold, fontSize: fs(15), color: C.text }}>New folder</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </Modal>
  );
}

// ── Library tab ───────────────────────────────────────────────────────────────

function LibraryTab({ onCourseSelect, onUpload, onFeynman, onRequireAuth, noteCount, openBrowse, onBrowseOpened, C, fs, F }: {
  openBrowse: boolean; onBrowseOpened: () => void;
  onCourseSelect: (id: Id<'courses'>) => void; onUpload: () => void; onRequireAuth: () => void;
  onFeynman: (id: string, title: string, feynmanTopics: any[]) => void;
  noteCount: number;
  C: AppColors; fs: (n: number) => number; F: any;
}) {
  const [section, setSection] = useState<'paths' | 'notes'>('paths');
  const [query, setQuery] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [contextMenuCourse, setContextMenuCourse] = useState<any>(null);
  const removeCourse = useMutation(api.courses.remove);
  const rawLibCourses = useQuery(api.courses.listMine);
  const isLibLoading = rawLibCourses === undefined;
  const personalCourses = (rawLibCourses ?? []) as any[];
  const folders = (useQuery(api.courses.listFolders) ?? []) as any[];
  const { isPremium } = useEntitlement();
  const glim = useAppStore((s) => s.glim);
  const palette = useMemo(() => paletteForInterests(glim.interests), [glim.interests]);

  const activeFolderName = folders.find((f: any) => f._id === activeFolderId)?.name ?? null;

  const filtered = useMemo(() => {
    let list = personalCourses;
    if (activeFolderId) list = list.filter((c: any) => c.folderId === activeFolderId);
    if (query.trim()) { const q = query.toLowerCase(); list = list.filter((c: any) => c.title?.toLowerCase().includes(q)); }
    return list;
  }, [personalCourses, query, activeFolderId]);

  return (
    <View style={{ flex: 1 }}>
      {/* header */}
      <View style={lib.header}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.extraBold, fontSize: fs(30), color: C.text, letterSpacing: -0.8 }}>Library</Text>
          <Text style={{ fontFamily: F.regular, fontSize: fs(14), color: C.sub, marginTop: 2 }}>
            {section === 'paths' ? 'Topics that go deeper every day' : 'Study your own notes, PDFs and lectures'}
          </Text>
        </View>
        {NOTES_ENABLED && section === 'notes' && !isPremium && (
          <View style={[lib.chip, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={{ fontFamily: F.semiBold, fontSize: fs(12), color: C.sub }}>
              {Math.min(noteCount, FREE_NOTE_LIMIT)}/{FREE_NOTE_LIMIT} free
            </Text>
          </View>
        )}
      </View>

      {/* Paths | Notes */}
      {NOTES_ENABLED && <View style={[lib.segment, { backgroundColor: C.surface, borderColor: C.border }]}>
        {(['paths', 'notes'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            activeOpacity={0.8}
            onPress={() => { if (k !== section) { Haptics.selectionAsync(); setSection(k); } }}
            style={[lib.segmentItem, section === k && { backgroundColor: C.surfaceAlt }]}
          >
            <Ionicons name={k === 'paths' ? 'trail-sign-outline' : 'document-text-outline'} size={15} color={section === k ? C.text : C.muted} />
            <Text style={{ fontFamily: F.semiBold, fontSize: fs(14), color: section === k ? C.text : C.muted }}>
              {k === 'paths' ? 'Paths' : 'My notes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>}

      {/* search + folder (notes only) */}
      {section === 'notes' && <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
        <View style={[lib.search, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Ionicons name="search" size={15} color={C.muted} />
          <TextInput
            style={{ flex: 1, paddingTop: 0, fontFamily: F.regular, fontSize: fs(14), color: C.text }}
            placeholder="Search"
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            selectionColor={C.primary}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setShowFolderPicker(true); }}
          activeOpacity={0.75}
          style={[lib.folderBtn, { backgroundColor: activeFolderId ? C.primaryBg : C.surface, borderColor: activeFolderId ? C.primaryRing : C.border }]}
        >
          <Ionicons name={activeFolderId ? 'folder' : 'folder-outline'} size={15} color={activeFolderId ? C.primary : C.sub} />
          <Text style={{ fontFamily: F.semiBold, fontSize: fs(13), color: activeFolderId ? C.text : C.sub, maxWidth: 90 }} numberOfLines={1}>
            {activeFolderName ?? 'All'}
          </Text>
          <Ionicons name="chevron-down" size={12} color={C.muted} />
        </TouchableOpacity>
      </View>}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl, gap: 10 }}
      >
        {section === 'paths' && (
          <PathsSection layout="grid" C={C} F={F} fs={fs} onRequireAuth={onRequireAuth}
            openBrowse={openBrowse} onBrowseOpened={onBrowseOpened} />
        )}
        {section === 'notes' && <>
        {isLibLoading && [0, 1, 2].map((i) => (
          <View key={i} style={[lib.card, { backgroundColor: C.surface, borderColor: C.border, opacity: 1 - i * 0.25 }]}>
            <View style={[lib.tile, { backgroundColor: C.surfaceAlt }]} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ height: 10, borderRadius: 5, width: '60%', backgroundColor: C.surfaceAlt }} />
              <View style={{ height: 10, borderRadius: 5, width: '30%', backgroundColor: C.surfaceAlt }} />
            </View>
          </View>
        ))}

        {!isLibLoading && filtered.map((course: any, i: number) => {
          const { icon, color } = topicIcon(course.title);
          const date = new Date(course._creationTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const isGenerating = course.status === 'generating';
          return (
            <Animated.View key={course._id} entering={FadeInDown.delay(Math.min(i, 8) * 35).duration(320)}>
              <View style={[lib.card, { backgroundColor: C.surface, borderColor: C.border, opacity: isGenerating ? 0.7 : 1 }]}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}
                  activeOpacity={0.7}
                  onPress={() => { Haptics.selectionAsync(); onCourseSelect(course._id as Id<'courses'>); }}
                  onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setContextMenuCourse(course); }}
                  delayLongPress={400}
                >
                  <View style={[lib.tile, { backgroundColor: hexA(color, 0.12), borderColor: hexA(color, 0.22) }]}>
                    {isGenerating
                      ? <ActivityIndicator size="small" color={color} />
                      : <Ionicons name={icon} size={20} color={color} />}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontFamily: F.semiBold, fontSize: fs(15), color: C.text }} numberOfLines={1}>
                      {course.title}
                    </Text>
                    <Text style={{ fontFamily: F.regular, fontSize: fs(12), color: isGenerating ? C.primary : C.muted }}>
                      {isGenerating ? 'Generating…' : date}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); setContextMenuCourse(course); }}
                  hitSlop={10}
                  style={{ paddingLeft: 12, paddingVertical: 6 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={17} color={C.muted} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })}

        {!isLibLoading && filtered.length === 0 && (
          <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'center', paddingTop: Spacing.xl, gap: Spacing.sm }}>
            <Glim size={96} stage={glim.stage} palette={palette} mood="sleepy" wander={false} />
            <Text style={{ fontSize: fs(18), fontFamily: F.extraBold, color: C.text, marginTop: Spacing.md }}>
              {query.trim() ? 'Nothing matches' : activeFolderId ? 'This folder is empty' : 'Nothing here yet'}
            </Text>
            <Text style={{ fontSize: fs(14), fontFamily: F.regular, color: C.sub, textAlign: 'center', lineHeight: 21, paddingHorizontal: Spacing.xl }}>
              {query.trim()
                ? 'Try a different search.'
                : 'Add class notes, a PDF or a lecture and turn it into flashcards, quizzes and Feynman practice.'}
            </Text>
            {!query.trim() && (
              <TouchableOpacity
                onPress={onUpload}
                activeOpacity={0.85}
                style={[lib.cta, { backgroundColor: C.text }]}
              >
                <Ionicons name="add" size={18} color={C.bg} />
                <Text style={{ fontFamily: F.semiBold, fontSize: fs(15), color: C.bg }}>Add notes</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
        </>}
      </ScrollView>

      <FolderPickerSheet
        visible={showFolderPicker}
        folders={folders}
        activeFolderId={activeFolderId}
        onSelect={setActiveFolderId}
        onDismiss={() => setShowFolderPicker(false)}
        onCreateFolder={() => setShowCreateFolder(true)}
        C={C} fs={fs} F={F}
      />
      <CreateFolderSheet
        visible={showCreateFolder}
        onDismiss={() => setShowCreateFolder(false)}
        onCreated={(folderId) => { setActiveFolderId(folderId); setShowCreateFolder(false); }}
        C={C} fs={fs} F={F}
      />

      {/* ── Course context menu ── */}
      {contextMenuCourse && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setContextMenuCourse(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setContextMenuCourse(null)} />
            <Animated.View
              entering={FadeInDown.duration(240)}
              style={[lib.menu, { backgroundColor: C.surface, borderColor: C.border }]}
            >
              <View style={[lib.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}>
                {(() => { const { icon, color } = topicIcon(contextMenuCourse.title); return (
                  <View style={[lib.tile, { width: 40, height: 40, backgroundColor: hexA(color, 0.12), borderColor: hexA(color, 0.22) }]}>
                    <Ionicons name={icon} size={18} color={color} />
                  </View>
                ); })()}
                <Text style={{ flex: 1, fontFamily: F.semiBold, fontSize: fs(15), color: C.text }} numberOfLines={1}>{contextMenuCourse.title}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[lib.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}
                onPress={() => {
                  const course = contextMenuCourse;
                  setContextMenuCourse(null);
                  setTimeout(() => onFeynman(course._id, course.title, course.feynmanTopics ?? []), 250);
                }}
              >
                <Ionicons name="mic-outline" size={19} color={C.text} />
                <Text style={{ fontFamily: F.semiBold, fontSize: fs(15), color: C.text }}>Explain it (Feynman)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={lib.menuRow}
                onPress={() => {
                  const course = contextMenuCourse;
                  setContextMenuCourse(null);
                  setTimeout(() => {
                    Alert.alert('Delete this note?', 'This permanently deletes it and everything made from it.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete', style: 'destructive',
                        onPress: async () => {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          await removeCourse({ courseId: course._id as Id<'courses'> });
                        },
                      },
                    ]);
                  }, 250);
                }}
              >
                <Ionicons name="trash-outline" size={19} color={C.error} />
                <Text style={{ fontFamily: F.semiBold, fontSize: fs(15), color: C.error }}>Delete</Text>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity
              style={[lib.menuCancel, { backgroundColor: C.surface, borderColor: C.border }]}
              activeOpacity={0.75}
              onPress={() => setContextMenuCourse(null)}
            >
              <Text style={{ fontFamily: F.semiBold, fontSize: fs(15), color: C.text }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

const lib = StyleSheet.create({
  segment: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.md, padding: 4, borderRadius: 14, borderWidth: 1, gap: 4 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 4 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, height: 44 },
  folderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, height: 44 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, gap: 14 },
  tile: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 13, marginTop: Spacing.md },
  menu: { marginHorizontal: 14, marginBottom: 10, borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  menuCancel: { marginHorizontal: 14, marginBottom: 36, borderRadius: 18, borderWidth: 1, paddingVertical: 16, alignItems: 'center' },
});

const libStyles = StyleSheet.create({
  pickerSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 36,
  },
  pickerHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.lg, paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerRowTxt: { flex: 1 },
  pickerNewFolder: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.lg, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4,
  },
  pickerAddIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
});

// ── Root ─────────────────────────────────────────────────────────────────────

const FREE_NOTE_LIMIT = 1;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { C, fs, F } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const { isConnected, networkLoading } = useNetworkStatus();
  const { isPremium } = useEntitlement();
  const rawAllCourses = useQuery(api.courses.listMine);
  const myStats = useQuery(api.courses.getMyStats);
  const noteCount = myStats?.totalNotesCreated ?? (rawAllCourses ?? []).length;
  const [activeTab, setActiveTab] = useState<HomeTab>('home');
  const [showQuest, setShowQuest] = useState(false);
  const [showFeynman, setShowFeynman]     = useState(false);
  const [feynmanCourse, setFeynmanCourse] = useState<{ id: string; title: string; feynmanTopics: any[] } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // + button with notes hidden: jump to Library and open "Learn anything".
  const [openBrowse, setOpenBrowse] = useState(false);
  const [createSourceTab, setCreateSourceTab] = useState<'pdf' | 'youtube' | 'text' | 'capture'>('pdf');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authReason, setAuthReason] = useState<AuthReason>('account');
  // What to do once the user signs in (continue what they were trying to do).
  const afterAuth = React.useRef<(() => void) | null>(null);
  const askAuth = (reason: AuthReason, then?: () => void) => {
    setAuthReason(reason);
    afterAuth.current = then ?? null;
    setShowAuthModal(true);
  };

  // Right after a trial/purchase starts: offer to save Glim + Pro to an account.
  // Waits for the quest screen to close (iOS can't stack two sheets).
  const askToSaveAccount = useAppStore((s) => s.askToSaveAccount);
  const setAskToSaveAccount = useAppStore((s) => s.setAskToSaveAccount);
  const questCount = useAppStore((s) => Object.keys(s.questLog).length);
  const guidePending = useAppStore((s) => s.guidePending);
  // Dev: replay the guided first quest on every launch (lib/features.ts).
  useEffect(() => { if (GUIDE_PREVIEW) useAppStore.getState().setGuidePending(true); }, []);
  useEffect(() => {
    if (!askToSaveAccount) return;
    if (isAuthenticated) { setAskToSaveAccount(false); return; }
    // Ask to save Glim only after their first quest — not the second they've paid.
    if (questCount === 0) return;
    if (showQuest || showAuthModal) return;
    const t = setTimeout(() => { setAskToSaveAccount(false); askAuth('save'); }, 700);
    return () => clearTimeout(t);
  }, [askToSaveAccount, isAuthenticated, showQuest, showAuthModal, questCount, guidePending]);
  const [detailCourse, setDetailCourse] = useState<Id<'courses'> | null>(null);
  const [activeCourse, setActiveCourse] = useState<Id<'courses'> | null>(null);
  const [playerMode, setPlayerMode] = useState<'flashcards' | 'quiz' | 'diagram' | undefined>(undefined);
  const [pdfView, setPdfView] = useState<{ url: string; title: string } | null>(null);

  // One paywall everywhere (components/paywall/Paywall.tsx).
  const showUpgradeWall = async () => { await openPaywall(); };
  // Latest version, so a post-sign-in retry sees isAuthenticated = true.
  const upgradeRef = React.useRef(showUpgradeWall);
  upgradeRef.current = showUpgradeWall;


  const guardNoteLimit = (): boolean => {
    if (isPremium || noteCount < FREE_NOTE_LIMIT) return true;
    showUpgradeWall();
    return false;
  };

  const handleCreateOption = (opt: CreateOptionKey) => {
    setShowCreateModal(false);
    if (!guardNoteLimit()) return;
    const tab = opt === 'youtube' ? 'youtube' : opt === 'text' ? 'text' : opt === 'capture' ? 'capture' : 'pdf';
    setCreateSourceTab(tab);
    if (isAuthenticated) { setShowUpload(true); } else { askAuth('notes', () => setShowUpload(true)); }
  };

  const handleCreatePress = () => {
    if (!NOTES_ENABLED) { setActiveTab('library'); setOpenBrowse(true); return; }
    if (!isAuthenticated) { askAuth('notes', () => setShowCreateModal(true)); return; }
    if (!guardNoteLimit()) return;
    setShowCreateModal(true);
  };

  if (showUpload) return (
    <UploadScreen
      onBack={() => setShowUpload(false)}
      onGoToLibrary={() => { setShowUpload(false); setActiveTab('library'); }}
      initialSourceTab={createSourceTab}
      onGenerated={(courseId) => {
        setShowUpload(false);
        setDetailCourse(courseId as Id<'courses'>);
      }}
    />
  );
  if (pdfView) return (
    <PdfViewerScreen url={pdfView.url} title={pdfView.title} onBack={() => setPdfView(null)} />
  );
  if (activeCourse) return (
    <LessonPlayer
      courseId={activeCourse}
      initialView={playerMode}
      onBack={() => { setActiveCourse(null); setPlayerMode(undefined); }}
    />
  );
  if (detailCourse) return (
    <CourseDetailScreen
      courseId={detailCourse}
      onBack={() => setDetailCourse(null)}
      onOpenFlashcards={() => { setPlayerMode('flashcards'); setActiveCourse(detailCourse); }}
      onOpenQuiz={() => { setPlayerMode('quiz'); setActiveCourse(detailCourse); }}
      onOpenDiagram={() => { setPlayerMode('diagram'); setActiveCourse(detailCourse); }}
      onOpenPdf={(url, title) => setPdfView({ url, title })}
      onOpenFeynman={(title, feynmanTopics) => {
        setFeynmanCourse({ id: detailCourse as string, title, feynmanTopics });
        setDetailCourse(null);
        setShowFeynman(true);
      }}
    />
  );

  const showOfflineBanner = !networkLoading && !isConnected;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      {showOfflineBanner && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[rootStyles.networkBanner, { backgroundColor: C.warningBg }]}
        >
          <Ionicons name="cloud-offline-outline" size={13} color={C.warning} />
          <Text style={{ color: C.warning, fontFamily: F.semiBold, fontSize: fs(12) }}>
            No internet connection
          </Text>
        </Animated.View>
      )}

      <View style={{ flex: 1 }}>
        {activeTab === 'home' && (
          <TodayTab onStartQuest={() => setShowQuest(true)} C={C} fs={fs} F={F} />
        )}
        {activeTab === 'library' && (
          <LibraryTab
            onRequireAuth={() => askAuth('path')}
            onCourseSelect={setDetailCourse}
            onUpload={() => { if (!isAuthenticated) { askAuth('notes', () => setShowCreateModal(true)); return; } if (!guardNoteLimit()) return; setShowCreateModal(true); }}
            onFeynman={(id, title, feynmanTopics) => { setFeynmanCourse({ id, title, feynmanTopics }); setShowFeynman(true); }}
            noteCount={noteCount}
            openBrowse={openBrowse}
            onBrowseOpened={() => setOpenBrowse(false)}
            C={C} fs={fs} F={F}
          />
        )}
        {activeTab === 'profile' && (
          <SettingsScreen onNavigateToCourses={() => setActiveTab('library')} />
        )}
      </View>

      <BottomTabBar
        activeTab={activeTab}
        onTabPress={setActiveTab}
        onCreatePress={handleCreatePress}
        bottomInset={insets.bottom}
        C={C} F={F} fs={fs}
      />

      <QuestScreen visible={showQuest} onClose={() => setShowQuest(false)} />

      <CreateModal
        visible={showCreateModal}
        onDismiss={() => setShowCreateModal(false)}
        onSelectOption={handleCreateOption}
        C={C} F={F} fs={fs}
      />

      <AuthModal
        visible={showAuthModal}
        reason={authReason}
        onDismiss={() => { setShowAuthModal(false); afterAuth.current = null; }}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          const next = afterAuth.current;
          afterAuth.current = null;
          if (next) setTimeout(next, 350); // let the sheet slide away first
        }}
      />

      {/* ── Feynman modal ── */}
      <Modal
        visible={showFeynman}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => { setShowFeynman(false); setFeynmanCourse(null); }}
      >
        <FeynmanScreen
          onClose={() => { setShowFeynman(false); setFeynmanCourse(null); }}
          onOpenLibrary={() => { setShowFeynman(false); setFeynmanCourse(null); setActiveTab('library'); }}
          initialCourse={feynmanCourse ?? undefined}
        />
      </Modal>
    </View>
  );
}

const rootStyles = StyleSheet.create({
  networkBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg, paddingVertical: 7 },
});

