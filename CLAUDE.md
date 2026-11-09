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

**Unloq** is an Expo (React Native) learning app: a pet (Glim) grows as you complete one short daily quest and explain it out loud. Students can also upload notes/PDFs to study from (flashcards, quizzes, mind maps, Feynman practice).

### Navigation

The app uses **manual state-based navigation**, not expo-router or React Navigation (both are installed but unused). `App.tsx` reads `flow` from Zustand and conditionally renders one of these screens:

- `loading` → splash
- `onboarding` → `app/onboarding.tsx`
- `home` → `app/home.tsx` (also rendered for legacy `goalsetup` / `locked`)

Screens receive an `onComplete` callback prop to trigger flow transitions.

### State Management

Zustand store at `store/useAppStore.ts` holds the entire app state:
- `flow` — current screen
- `courses[]` — user's uploaded courses, each with `lessons[]`
- `activeCourseId` / `activeLessonIndex` — playback position

### Design System

- **Theme:** `constants/theme.ts` — font families (Inter + Space Grotesk; Nunito still loaded for legacy screens)
- **Spacing:** `constants/spacing.ts` — scale: `xs=4, sm=8, md=16, lg=24, xl=32, xxl=48`
- **Fonts:** Inter, Space Grotesk, Nunito via `@expo-google-fonts/*`, loaded in `App.tsx`
- **Animations:** `react-native-reanimated` v4 — timed easing, no bouncy springs (see Visual Language)
- **Haptics:** `expo-haptics` for feedback

### Path Aliases

`@/` resolves to the project root (e.g., `import { theme } from '@/constants/theme'`).

### Key Notes

- Portrait-only orientation enforced in `app.json`
- Strict TypeScript enabled (`strict: true`)

### Product Model (pet + daily quest)

- Unloq is a learning app that replaces doomscrolling — **app blocking is legacy** (familyControls, `goalsetup`/`locked` flows, `blockDurationHours`). Those flows now render Home; don't surface blocking in UI.
- **Glim** (`components/mascot/Glim.tsx`, Skia) is the pet. It grows by XP (`lib/quests.ts` → `STAGE_XP`, `stageForXp`); state lives in `useAppStore().glim` + `questLog`.
- **One quest per day**: picker wheel picks a topic (`components/quest/TopicWheel.tsx`; everyone gets one re-spin, and the day's result is saved in `todaySpin` so closing the quest can't re-roll it) → read → explain out loud once (`VoiceExplain`) → graded (`gradeAgainst`) → XP. Flow is `app/quest.tsx`.
- **Content = learning paths** (Convex `paths` + `pathTopics`): curated outlines live in `convex/curatedPaths.ts` (seed with `npx convex run paths:seedCurated`); users can create custom paths from any prompt (`pathsAi:createPath`, sign-in required). Readings are generated lazily by Gemini (`pathsAi:ensureReading`) and shared; grading is `pathsAi:gradeExplanation` with on-device fallback. Path progress is stored on-device (`activePaths` in the store). The wheel shows the next topic of each followed path + one daily Discover pick (`lib/usePaths.ts`). `lib/quests.ts` QUEST_BANK is only the offline fallback.
- **Topic titles are questions/hooks** ("What if you'd invested $100 at age 10?") with a plain `concept` tag ("Compound interest") shown above them (wheel landing, reading, explain card, history). Rules live in `TITLE_RULES` (`convex/pathsAi.ts`); readings answer the title in the first lines, show a one-line "You'll explain" (`points`) and **bold** key phrases. **Illustrations** (curated only): `pathsAi:illustrate` draws one explainer image per topic (`gpt-image-2`, `ILLUSTRATION_STYLE` "ink") into Convex storage; it shows at the top of the lesson (`components/paths/LessonIllustration.tsx`) only once approved in **Unloq Studio** (`studio/`, `npm run studio`, Illustrations tab). Editing a curated title/brief and re-running `paths:seedCurated` renames by position (progress safe) and clears that reading so it regenerates. Main model is a stable Gemini (`GEMINI_MODEL`), never a preview.
- **Path sigils** (`lib/sigil.ts`, `components/paths/PathSigil.tsx`): every path has a two-tone geometric mark instead of an icon. Curated paths have a hand-designed `sigil` spec + duotone `color` in `convex/curatedPaths.ts` (preview a spec before changing it); custom paths generate one from their slug. `lib/pathColors.ts` keeps duos unique among followed paths. Glim is the pet only — don't use it as a list icon.
- **Monetization** (`lib/pro.ts`, entitlement `premium`): Pro = explaining out loud (AI grading → XP → Glim grows) + creating custom paths. Reading and following paths stay free; "just read" saves a `readOnly` quest entry (keeps streak + path progress, no XP). Onboarding ends with a "teach Glim" demo (`pathsAi:gradeDemo`, public, cheap `GEMINI_LITE_MODEL`, fixed facts from `convex/lib/demoFacts.ts`, per-device + global caps in `usage`, on-device fallback) then the paywall with a 3-day free trial. Server checks Pro via RevenueCat REST (`convex/lib/revenuecat.ts`, needs `REVENUECAT_SECRET_KEY`; fails open). **Paywall** is custom (`components/paywall/Paywall.tsx`, not RevenueCat's template): founder video (`FOUNDER_VIDEO`) + the *current offering's* Annual/Monthly packages (price, trial eligibility, "Save X%") + optional offering metadata (`headline`, `subheadline`, `highlight`, `badge`, `show_timeline`) so price/trial/copy tests run from RevenueCat without an app update. `openPaywall()` shows it via `PaywallHost`; inside other modals use `PaywallModal`. **Hard paywall** (`HARD_PAYWALL` in `lib/features.ts`, gate in `app/pro-gate.tsx`): without Pro the app shows "Glim is resting" (subscribe / restore / sign in) — progress is never deleted; set it false for the soft model above. Notes are hidden behind `NOTES_ENABLED`.
- **Guided first quest** (`components/guide/CoachTip.tsx`): after the first unlock with no quests (`afterUnlock` → `guidePending`), Glim tips walk through Today → spin → read → explain → result (5 steps, skippable); it ends when the first quest is saved. The "Save Glim" account prompt waits until after that first quest.
- **Rating prompt** (`lib/review.ts`): asked only after an aha moment on the result screen (Glim evolves, score 90+, or a 7-day streak), once someone has 3+ explained quests, at most every 30 days (`reviewAskedAt`); never after a miss, in onboarding or around the paywall. Apple shows it ≤3×/year and never in the simulator/TestFlight.
- A broken streak only makes Glim sad (sleepy + droop); never remove XP.
- **Explaining is graded by Gemini only** (no keyword fallback): `VoiceExplain` records audio with `expo-audio` (metering; up to 3 takes × 1-minute countdown, listen back → submit or re-record; cancelled or silent takes don't count; nothing is sent until submit) → `pathsAi:gradeExplanation` transcribes it *without* the lesson in the prompt (seen with the lesson, Gemini invented speech from silence), rejects transcripts too long for the recording, then grades the text. Typed explanations skip transcription. AI failure → a retry screen, never a fake grade. Same flow for `gradeDemo` (lite model).
- **XP rule** (`convex/lib/xp.ts`, shared by AI + on-device graders): only good explanations earn XP — score < 50 → 0 (Glim looks confused), 50–89 → 5–21, 90+ → +5 bonus. Missed ideas are saved on the quest entry and come back after 3 days as a **bonus review** (`components/quest/ReviewScreen.tsx`, offered on Today after the daily quest) for +10 XP. Growth curve `STAGE_XP` = Drop ~10 days (~6–11% of the bar per quest), Bloom ~6 weeks, Radiant ~5 months at one quest a day — kept realistic on purpose, not a trial hook.
- **Keep learning**: after the daily quest (stored in `questLog`, drives streak + week row), Pro users can do more (stored in `extras`, up to `MAX_QUESTS_PER_DAY`). Extras earn little XP (`extraXp`: 40/25/15/10%, max +12/day — "Glim's full for today") so nobody can race Glim ahead (max ~1.6× the one-a-day pace); reviews come only from daily quests.
- Tabs: **Today** (`components/today/TodayTab.tsx`), **Library** (uploaded notes/PDFs for students, in `app/home.tsx`), **Profile** (`app/settings.tsx`: Glim, stats, learning settings, account).

### Visual Language

- Main app is **always dark** and matches onboarding: tokens in `constants/Colors.ts` (`DarkColors` ≈ onboarding `O`), Inter for text, Space Grotesk (`F.extraBold`) for headlines/numbers.
- Greyscale with one accent per element; depth via 1px borders + soft shadows, not hard "Duo" slabs.
- Motion: calm timed fades/slides with a cause. **No springy/bouncy entrance animations** — the user dislikes them.
- Never call plain JS helpers inside Reanimated worklets (`useAnimatedStyle` etc.) — precompute on the JS thread.
