import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AppFlow = 'loading' | 'onboarding' | 'goalsetup' | 'home' | 'locked';

export interface GoalConfig {
  frequency: 'daily' | 'weekdays' | 'custom';
  customDays: number[]; // JS day indices 0=Sun…6=Sat
  lessonTarget: number;
  lockTime: string; // 'HH:MM' — used as reminder time
  examDate: string | null; // 'YYYY-MM-DD' or null
}

interface DailyProgress {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

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

  setFlow: (flow: AppFlow) => void;
  setRevenueCatReady: (ready: boolean) => void;
  setGoalConfig: (config: GoalConfig) => void;
  setExamDate: (date: string | null) => void;
  setActiveCourse: (id: string) => void;
  incrementDailyProgress: () => void;
  toggleDarkMode: () => void;
  increaseFontScale: () => void;
  decreaseFontScale: () => void;
  setOnboardingRole: (role: string) => void;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      flow: 'loading',
      goalConfig: { frequency: 'daily', customDays: [], lessonTarget: 1, lockTime: '08:00', examDate: null },
      dailyProgress: { date: todayStr(), count: 0 },
      activeCourseId: null,
      activeLessonIndex: 0,
      darkMode: false,
      fontScale: 1.05,
      revenueCatReady: false,
      onboardingRole: null,

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
          return {
            dailyProgress: {
              date: today,
              count: prev.date === today ? prev.count + 1 : 1,
            },
          };
        }),
      setOnboardingRole: (role) => set({ onboardingRole: role }),
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
        onboardingRole: s.onboardingRole,
      }),
    },
  ),
);
