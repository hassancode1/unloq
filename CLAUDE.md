# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in browser
```

No test or lint scripts are configured.

## Architecture

**Unloq** is an Expo (React Native) app that blocks phone apps until the user completes daily lessons generated from uploaded documents (PDF, DOCX, plain text). Targets iOS Screen Time integration.

### Navigation

The app uses **manual state-based navigation**, not expo-router or React Navigation (both are installed but unused). `App.tsx` reads `flow` from Zustand and conditionally renders one of these screens:

- `loading` → splash
- `onboarding` → `app/onboarding.tsx`
- `goalsetup` → `app/goal-setup.tsx`
- `home` → `app/home.tsx`
- `locked` → locked state

Screens receive an `onComplete` callback prop to trigger flow transitions.

### State Management

Zustand store at `store/useAppStore.ts` holds the entire app state:
- `flow` — current screen
- `courses[]` — user's uploaded courses, each with `lessons[]`
- `activeCourseId` / `activeLessonIndex` — playback position

### Design System

- **Theme:** `constants/theme.ts` — color palette (primary: `#6366F1` indigo), font families (Nunito variants)
- **Spacing:** `constants/spacing.ts` — scale: `xs=4, sm=8, md=16, lg=24, xl=32, xxl=48`
- **Fonts:** `@expo-google-fonts/nunito` (weights 400/600/700/800), loaded in `App.tsx`
- **Animations:** `react-native-reanimated` v4 with spring animations (see `DuoButton`, onboarding)
- **Haptics:** `expo-haptics` for feedback

### Path Aliases

`@/` resolves to the project root (e.g., `import { theme } from '@/constants/theme'`).

### Key Notes

- `hooks/` and `lib/` directories exist but are empty — reserved for future use
- No backend integration yet; AI document parsing is not implemented
- Portrait-only orientation enforced in `app.json`
- Strict TypeScript enabled (`strict: true`)
