import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AppFlow = 'loading' | 'onboarding' | 'goalsetup' | 'home' | 'locked';

export interface GoalConfig {
  frequency: 'daily' | 'weekdays' | 'custom';
  customDays: number[]; // JS day indices 0=Sun…6=Sat
  lessonTarget: number;
  lockTime: string; // 'HH:MM'
}

interface DailyProgress {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

interface Course {
  id: string;
  title: string;
  docName: string;
  lessons: Lesson[];
  createdAt: number;
}

interface Lesson {
  id: string;
  title: string;
  content: string;
  question: string;
  options: string[];
  correctIndex: number;
  completed: boolean;
}

interface AppState {
  flow: AppFlow;
  goalConfig: GoalConfig | null;
  dailyProgress: DailyProgress;
  courses: Course[];
  activeCourseId: string | null;
  activeLessonIndex: number;

  setFlow: (flow: AppFlow) => void;
  setGoalConfig: (config: GoalConfig) => void;
  addCourse: (course: Course) => void;
  setActiveCourse: (id: string) => void;
  completeLesson: (courseId: string, lessonId: string) => void;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      flow: 'loading',
      goalConfig: { frequency: 'daily', customDays: [], lessonTarget: 1, lockTime: '08:00' },
      dailyProgress: { date: todayStr(), count: 0 },
      courses: [],
      activeCourseId: null,
      activeLessonIndex: 0,

      setFlow: (flow) => set({ flow }),
      setGoalConfig: (config) => set({ goalConfig: config }),
      addCourse: (course) => set((s) => ({ courses: [...s.courses, course] })),
      setActiveCourse: (id) => set({ activeCourseId: id, activeLessonIndex: 0 }),
      completeLesson: (courseId, lessonId) =>
        set((s) => {
          const today = todayStr();
          const prev = s.dailyProgress;
          const dailyProgress: DailyProgress = {
            date: today,
            count: prev.date === today ? prev.count + 1 : 1,
          };
          return {
            dailyProgress,
            courses: s.courses.map((c) =>
              c.id !== courseId
                ? c
                : {
                    ...c,
                    lessons: c.lessons.map((l) =>
                      l.id === lessonId ? { ...l, completed: true } : l
                    ),
                  }
            ),
          };
        }),
    }),
    {
      name: 'unloq-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        flow: s.flow,
        goalConfig: s.goalConfig,
        dailyProgress: s.dailyProgress,
        courses: s.courses,
        activeCourseId: s.activeCourseId,
        activeLessonIndex: s.activeLessonIndex,
      }),
    },
  ),
);

