import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  folders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Exam groups (e.g. "Bar Exam — MBE", "USMLE Step 1")
  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    sort_order: v.optional(v.number()),
  }).index("by_sort_order", ["sort_order"]),

  courses: defineTable({
    // User-uploaded courses
    userId: v.optional(v.id("users")),
    title: v.string(),
    description: v.string(),
    docName: v.string(),
    sourceType: v.optional(v.union(v.literal("pdf"), v.literal("youtube"))),
    totalLessons: v.number(),
    difficulty: v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ),
    status: v.union(
      v.literal("generating"),
      v.literal("ready"),
      v.literal("error")
    ),
    createdAt: v.number(),
    // Admin-managed fields
    adminCreated: v.optional(v.boolean()),
    published: v.optional(v.boolean()),
    group_id: v.optional(v.id("groups")),
    course_topic: v.optional(v.string()),
    sort_order: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    completedLessons: v.optional(v.number()),
    folderId: v.optional(v.id("folders")),
    pdfStorageId: v.optional(v.id("_storage")),
    feynmanTopics: v.optional(v.array(v.object({ title: v.string(), summary: v.string() }))),
  })
    .index("by_user", ["userId"])
    .index("by_published", ["published"])
    .index("by_group", ["group_id"])
    .index("by_admin_created", ["adminCreated"]),

  // Learning paths — a series of short daily topics that go deeper each day.
  // Curated paths are shared by everyone; custom ones belong to one user.
  paths: defineTable({
    slug: v.string(),
    title: v.string(),
    subtitle: v.string(),
    interest: v.string(),            // matches onboarding interest ids (history, psychology, …)
    curated: v.boolean(),
    ownerId: v.optional(v.id("users")),
    prompt: v.optional(v.string()),  // what the user typed for custom paths
    status: v.union(v.literal("outlining"), v.literal("ready"), v.literal("error")),
    topicCount: v.number(),
    sortOrder: v.optional(v.number()),
    trending: v.optional(v.boolean()), // curated: shown under "Trending"
    icon: v.optional(v.string()),      // legacy, unused
    sigil: v.optional(v.string()),     // hand-designed mark spec (lib/sigil.ts); custom paths use their slug
    color: v.optional(v.string()),     // duotone pair name from SIGIL_DUOS (lib/sigil.ts)
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_curated", ["curated"])
    .index("by_owner", ["ownerId"]),

  // Account backup of the on-device learning state (Glim, quest log, paths).
  progress: defineTable({
    userId: v.id("users"),
    data: v.any(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Daily counters for rate limits and AI cost caps (key e.g. "demo:device:<id>").
  usage: defineTable({
    key: v.string(),
    day: v.string(), // YYYY-MM-DD (UTC)
    count: v.number(),
  }).index("by_key_day", ["key", "day"]),

  pathTopics: defineTable({
    pathId: v.id("paths"),
    order: v.number(),               // 0-based day in the path
    title: v.string(),               // a question or curiosity hook ("What if you'd invested $100 at 10?")
    concept: v.optional(v.string()), // the plain topic it teaches ("Compound interest"), 2–4 words
    summary: v.string(),             // one-line brief from the outline; guides the reading
    // Filled lazily the first time anyone reaches this topic, then shared.
    reading: v.optional(v.string()), // paragraphs; key phrases wrapped in **bold**
    hook: v.optional(v.string()),    // headline that answers/teases the title (≤ 14 words)
    points: v.optional(v.array(v.string())), // "You'll explain": 3 short lines shown before reading
    figure: v.optional(v.any()),     // legacy: explainer figure data (no longer shown)
    // One explainer illustration (curated paths only). Hidden until approved
    // in the review gallery (components/profile/IllustrationReview.tsx).
    illustration: v.optional(v.object({
      storageId: v.id("_storage"),
      brief: v.string(),
      status: v.union(v.literal("review"), v.literal("approved"), v.literal("rejected")),
      createdAt: v.number(),
    })),
    keyIdeas: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.array(v.string()))), // offline grader variants per key idea
    sources: v.optional(v.array(v.string())),
    status: v.union(v.literal("pending"), v.literal("generating"), v.literal("ready"), v.literal("error")),
  }).index("by_path_order", ["pathId", "order"]),

  userStats: defineTable({
    userId: v.id("users"),
    totalNotesCreated: v.number(),
  }).index("by_user", ["userId"]),

  lessons: defineTable({
    courseId: v.id("courses"),
    lessonNumber: v.number(),
    title: v.string(),
    keyConcept: v.string(),
    content: v.optional(v.array(v.object({ heading: v.string(), body: v.string() }))),
    flashcards: v.array(
      v.object({ front: v.string(), back: v.string() })
    ),
    quiz: v.array(
      v.object({
        question: v.string(),
        options: v.array(v.string()),
        correctAnswer: v.string(),
      })
    ),
    diagram: v.optional(v.object({
      root: v.string(),
      branches: v.array(v.object({
        name: v.string(),
        points: v.array(v.string()),
      })),
    })),
    completed: v.boolean(),
  }).index("by_course", ["courseId"]),
});
