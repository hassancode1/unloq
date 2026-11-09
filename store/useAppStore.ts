import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setStudyProgress } from '../lib/familyControls';
import { dayKey, stageForXp, type QuestEntry } from '../lib/quests';
import { REVIEW_AFTER_DAYS } from '../convex/lib/xp';

export type AppFlow = 'loading' | 'onboarding' | 'goalsetup' | 'home' | 'locked';

export interface GoalConfig {
  frequency: 'daily' | 'weekdays' | 'custom';
  customDays: number[]; // JS day indices 0=Sun…6=Sat
  lessonTarget: number;
  lockTime: string; // 'HH:MM' — used as reminder time
  examDate: string | null; // 'YYYY-MM-DD' or null
  goalSetDate?: string; // 'YYYY-MM-DD' — grace period: don't lock on the day goal was first set
}

interface DailyProgress {
  date: string;           // 'YYYY-MM-DD'
  count: number;
  sessionStartMs: number | null; // ms timestamp when today's block session started
}

export type LearnStyle = 'bites' | 'deep';
/** 'choose' = user picks the daily topic, 'random' = we surprise them. */
export type TopicMode = 'choose' | 'random';

/** Everything the onboarding collects about the user + their Glim. */
export interface GlimProfile {
  name: string;
  interests: string[];
  learnStyle: LearnStyle;
  topicMode: TopicMode;
  dailyMinutes: number;
  scrollWindows: string[];
  reminderTime: string; // 'HH:MM'
  screenHours: number;
  commitDays: number;
  xp: number;
  stage: 0 | 1 | 2 | 3 | 4;
}

export interface ActivePath {
  order: number;
  addedAt: number;
}

export const DEFAULT_GLIM: GlimProfile = {
  name: 'Glim',
  interests: [],
  learnStyle: 'bites',
  topicMode: 'random',
  dailyMinutes: 10,
  scrollWindows: [],
  reminderTime: '20:00',
  screenHours: 4,
  commitDays: 7,
  xp: 0,
  stage: 0,
};

export const FONT_SCALE_MIN  = 0.85;
export const FONT_SCALE_MAX  = 1.30;
export const FONT_SCALE_STEP = 0.05;

interface AppState {
  flow: AppFlow;
  goalConfig: GoalConfig | null;
  dailyProgress: DailyProgress;
  activeCourseId: string | null;
  activeLessonIndex: number;
  darkMode: boolean;
  fontScale: number;
  revenueCatReady: boolean;
  onboardingRole: string | null;
  semesterGoal: string | null;
  hoursLost: string | null;
  blockDurationHours: number;
  blockingEnabled: boolean;
  goalSavedAt: number | null;
  // YYYY-MM-DD on which the user completed their session — prevents the
  // completion modal from re-firing when HomeScreen remounts on the same day.
  sessionCompletedDate: string | null;
  glim: GlimProfile;
  /** One entry per day the daily quest was completed, keyed YYYY-MM-DD. */
  questLog: Record<string, QuestEntry>;
  /** "Keep learning" quests after the daily one, by day. The streak and week row use questLog only. */
  extras: Record<string, QuestEntry[]>;
  /** Paths the user is following → next topic index (0-based). */
  activePaths: Record<string, ActivePath>;
  /** True once starter paths were picked from onboarding interests. */
  pathsSeeded: boolean;
  /** Random id for this install (rate-limits the public onboarding demo grader). */
  deviceId: string;
  /** Today's wheel result: the topic it landed on and whether the one re-spin is used. */
  todaySpin: { day: string; key: string; respun: boolean } | null;
  /** Guided first quest after the first unlock (components/guide/CoachTip.tsx). */
  guidePending: boolean;
  setGuidePending: (v: boolean) => void;
  /** When we last asked for an App Store rating (lib/review.ts). */
  reviewAskedAt: number | null;
  setReviewAskedAt: (t: number) => void;
  setTodaySpin: (v: { day: string; key: string; respun: boolean }) => void;
  /** Set after a trial/purchase starts; Home asks to save Glim to an account (not persisted). */
  askToSaveAccount: boolean;
  setAskToSaveAccount: (v: boolean) => void;
  /** The custom paywall modal (components/paywall/PaywallHost.tsx); not persisted. */
  paywallOpen: boolean;
  setPaywallOpen: (v: boolean) => void;
  /** Onboarding interests that already got a starter path (never re-added after an unfollow). */
  seededInterests: string[];

  setFlow: (flow: AppFlow) => void;
  setRevenueCatReady: (ready: boolean) => void;
  setGoalConfig: (config: GoalConfig) => void;
  setExamDate: (date: string | null) => void;
  setActiveCourse: (id: string) => void;
  incrementDailyProgress: () => void;
  startBlockSession: () => void;
  toggleDarkMode: () => void;
  increaseFontScale: () => void;
  decreaseFontScale: () => void;
  setOnboardingRole: (role: string) => void;
  setSemesterGoal: (goal: string) => void;
  setHoursLost: (h: string) => void;
  setBlockDurationHours: (hours: number) => void;
  setBlockingEnabled: (enabled: boolean) => void;
  setGoalSavedAt: (ts: number) => void;
  setSessionCompleted: (date: string | null) => void;
  updateGlim: (patch: Partial<GlimProfile>) => void;
  /** Records today's quest and grows Glim. No-op if today is already done. */
  completeQuest: (entry: QuestEntry) => void;
  /** Bonus review of a past quest's missed ideas. Passed → XP + done; not → try again later. */
  completeReview: (day: string, r: { xp: number; passed: boolean; missed: string[] }) => void;
  addPath: (pathId: string, order?: number) => void;
  removePath: (pathId: string) => void;
  seedPaths: (pathIds: string[], interests?: string[]) => void;
}

function todayStr() {
  // Use local date so that timezone offsets don't shift the date relative to the user's clock
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      flow: 'loading',
      goalConfig: { frequency: 'daily', customDays: [], lessonTarget: 1, lockTime: '08:00', examDate: null },
      dailyProgress: { date: todayStr(), count: 0, sessionStartMs: null },
      activeCourseId: null,
      activeLessonIndex: 0,
      darkMode: false,
      fontScale: 1.05,
      revenueCatReady: false,
      onboardingRole: null,
      semesterGoal: null,
      hoursLost: null,
      blockDurationHours: 0.5,
      blockingEnabled: false,
      goalSavedAt: null,
      sessionCompletedDate: null,
      glim: DEFAULT_GLIM,
      questLog: {},
      extras: {},
      activePaths: {},
      pathsSeeded: false,
      deviceId: `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      todaySpin: null,
      guidePending: false,
      setGuidePending: (v) => set({ guidePending: v }),
      reviewAskedAt: null,
      setReviewAskedAt: (t) => set({ reviewAskedAt: t }),
      setTodaySpin: (v) => set({ todaySpin: v }),
      askToSaveAccount: false,
      setAskToSaveAccount: (v) => set({ askToSaveAccount: v }),
      paywallOpen: false,
      setPaywallOpen: (v) => set({ paywallOpen: v }),
      seededInterests: [],

      setFlow: (flow) => set({ flow }),
      setRevenueCatReady: (ready) => set({ revenueCatReady: ready }),
      setGoalConfig: (config) => set({ goalConfig: config }),
      setExamDate: (date) =>
        set((s) => ({
          goalConfig: s.goalConfig ? { ...s.goalConfig, examDate: date } : null,
        })),
      setActiveCourse: (id) => set({ activeCourseId: id, activeLessonIndex: 0 }),
      incrementDailyProgress: () =>
        set((s) => {
          const today = todayStr();
          const prev = s.dailyProgress;
          const sameDay = prev.date === today;
          const newCount = sameDay ? prev.count + 1 : 1;
          const target = s.goalConfig?.lessonTarget ?? 1;
          setStudyProgress(newCount, target).catch(() => {});
          return {
            dailyProgress: {
              date: today,
              count: newCount,
              sessionStartMs: sameDay ? prev.sessionStartMs : null,
            },
          };
        }),
      // Call once when the user opens the app with blocking active.
      // Sets the start timestamp for today — no-ops if already started today.
      startBlockSession: () =>
        set((s) => {
          const today = todayStr();
          const prev = s.dailyProgress;
          const alreadyStarted = prev.date === today && prev.sessionStartMs !== null;
          if (alreadyStarted) return {};
          return {
            dailyProgress: {
              date: today,
              count: prev.date === today ? prev.count : 0,
              sessionStartMs: Date.now(),
            },
          };
        }),
      setOnboardingRole: (role) => set({ onboardingRole: role }),
      setSemesterGoal: (goal) => set({ semesterGoal: goal }),
      setHoursLost: (h) => set({ hoursLost: h }),
      setBlockDurationHours: (hours) => set({ blockDurationHours: hours }),
      setBlockingEnabled: (enabled) => set({ blockingEnabled: enabled }),
      setGoalSavedAt: (ts) => set({ goalSavedAt: ts }),
      setSessionCompleted: (date) => set({ sessionCompletedDate: date }),
      updateGlim: (patch) => set((s) => ({ glim: { ...s.glim, ...patch } })),
      completeReview: (day, { xp, passed, missed }) => set((s) => {
        const e = s.questLog[day];
        if (!e || e.reviewedAt) return {};
        const total = s.glim.xp + xp;
        const next: QuestEntry = passed
          ? { ...e, reviewedAt: Date.now(), reviewXp: xp }
          : { ...e, missed: missed.length ? missed : e.missed, reviewAfter: Date.now() + REVIEW_AFTER_DAYS * 86400000 };
        return {
          questLog: { ...s.questLog, [day]: next },
          glim: { ...s.glim, xp: total, stage: Math.max(s.glim.stage, stageForXp(total)) as GlimProfile['stage'] },
        };
      }),
      completeQuest: (entry) => set((s) => {
        const key = dayKey(new Date(entry.completedAt));
        const extra = !!s.questLog[key]; // the day's first quest is the daily one
        const xp = s.glim.xp + entry.xp;
        const active = entry.pathId ? s.activePaths[entry.pathId] : undefined;
        return {
          ...(extra
            ? { extras: { ...s.extras, [key]: [...(s.extras?.[key] ?? []), entry] } }
            : { questLog: { ...s.questLog, [key]: entry } }),
          glim: { ...s.glim, xp, stage: Math.max(s.glim.stage, stageForXp(xp)) as GlimProfile['stage'] },
          ...(active && entry.pathId
            ? { activePaths: { ...s.activePaths, [entry.pathId]: { ...active, order: active.order + 1 } } }
            : {}),
        };
      }),
      addPath: (pathId, order = 0) => set((s) => (
        s.activePaths[pathId] ? {} : { activePaths: { ...s.activePaths, [pathId]: { order, addedAt: Date.now() } } }
      )),
      removePath: (pathId) => set((s) => {
        const { [pathId]: _, ...rest } = s.activePaths;
        return { activePaths: rest };
      }),
      seedPaths: (pathIds, interests = []) => set((s) => {
        const next = { ...s.activePaths };
        pathIds.forEach((id, i) => { if (!next[id]) next[id] = { order: 0, addedAt: Date.now() - i }; });
        const seededInterests = Array.from(new Set([...(s.seededInterests ?? []), ...interests]));
        return { activePaths: next, pathsSeeded: true, seededInterests };
      }),
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      increaseFontScale: () =>
        set((s) => ({
          fontScale: Math.min(
            FONT_SCALE_MAX,
            parseFloat((s.fontScale + FONT_SCALE_STEP).toFixed(2)),
          ),
        })),
      decreaseFontScale: () =>
        set((s) => ({
          fontScale: Math.max(
            FONT_SCALE_MIN,
            parseFloat((s.fontScale - FONT_SCALE_STEP).toFixed(2)),
          ),
        })),
    }),
    {
      name: 'unloq-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        flow: s.flow,
        goalConfig: s.goalConfig,
        dailyProgress: s.dailyProgress,
        activeCourseId: s.activeCourseId,
        activeLessonIndex: s.activeLessonIndex,
        darkMode: s.darkMode,
        fontScale: s.fontScale,
        // revenueCatReady intentionally NOT persisted — must be re-verified on every cold start
        onboardingRole: s.onboardingRole,
        semesterGoal: s.semesterGoal,
        hoursLost: s.hoursLost,
        blockDurationHours: s.blockDurationHours,
        blockingEnabled: s.blockingEnabled,
        goalSavedAt: s.goalSavedAt,
        sessionCompletedDate: s.sessionCompletedDate,
        glim: s.glim,
        questLog: s.questLog,
        extras: s.extras,
        activePaths: s.activePaths,
        pathsSeeded: s.pathsSeeded,
        deviceId: s.deviceId,
        seededInterests: s.seededInterests,
        todaySpin: s.todaySpin,
        reviewAskedAt: s.reviewAskedAt,
        guidePending: s.guidePending,
      }),
    },
  ),
);
