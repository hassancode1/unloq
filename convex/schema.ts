import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

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
  })
    .index("by_user", ["userId"])
    .index("by_published", ["published"])
    .index("by_group", ["group_id"])
    .index("by_admin_created", ["adminCreated"]),

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
