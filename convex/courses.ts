import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./lib/requireAdmin";

// ── Admin queries/mutations ───────────────────────────────────────────────────

export const listCourses = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("courses").order("desc").collect();
    const courses = all.filter((c) => c.adminCreated === true);
    return Promise.all(
      courses.map(async (course) => {
        const lessons = await ctx.db
          .query("lessons")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();
        const group = course.group_id ? await ctx.db.get(course.group_id) : null;
        return {
          ...course,
          total_lessons: lessons.length || course.totalLessons,
          course_topic: course.course_topic ?? course.docName,
          group_name: group?.name ?? null,
        };
      }),
    );
  },
});

export const getCourse = query({
  args: { id: v.id("courses") },
  handler: async (ctx, { id }) => {
    const course = await ctx.db.get(id);
    if (!course) return null;
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", id))
      .order("asc")
      .collect();
    const group = course.group_id ? await ctx.db.get(course.group_id) : null;
    return {
      ...course,
      total_lessons: lessons.length || course.totalLessons,
      course_topic: course.course_topic ?? course.docName,
      lesson_groups: lessons,
      group_name: group?.name ?? null,
    };
  },
});

export const deleteCourse = mutation({
  args: { id: v.id("courses") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", id))
      .collect();
    await Promise.all(lessons.map((l) => ctx.db.delete(l._id)));
    await ctx.db.delete(id);
  },
});

export const updateCourse = mutation({
  args: {
    id: v.id("courses"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    difficulty: v.optional(v.union(
      v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"),
      v.literal("Beginner"), v.literal("Intermediate"), v.literal("Advanced"),
    )),
    published: v.optional(v.boolean()),
    group_id: v.optional(v.union(v.id("groups"), v.null())),
    sort_order: v.optional(v.number()),
    course_topic: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    adminCreated: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, group_id, difficulty, adminCreated, ...rest }) => {
    await requireAdmin(ctx);
    const patch: Record<string, unknown> = { ...rest };
    if (group_id !== undefined) patch.group_id = group_id ?? undefined;
    if (difficulty !== undefined) {
      patch.difficulty = difficulty.toLowerCase() as "beginner" | "intermediate" | "advanced";
    }
    if (adminCreated !== undefined) patch.adminCreated = adminCreated;
    await ctx.db.patch(id, patch);
  },
});

export const reorderCourses = mutation({
  args: {
    items: v.array(v.object({ id: v.id("courses"), sort_order: v.number() })),
  },
  handler: async (ctx, { items }) => {
    await requireAdmin(ctx);
    await Promise.all(items.map(({ id, sort_order }) => ctx.db.patch(id, { sort_order })));
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const listPublishedAdminCourses = query({
  handler: async (ctx) => {
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
    return Promise.all(
      courses.map(async (course) => {
        const lessons = await ctx.db
          .query("lessons")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();
        const group = course.group_id ? await ctx.db.get(course.group_id) : null;
        const completedCount = lessons.filter((l) => l.completed).length;
        return {
          ...course,
          completedCount,
          lessonCount: lessons.length,
          group_name: group?.name ?? null,
        };
      }),
    );
  },
});

export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const userCourses = userId
      ? await ctx.db
          .query("courses")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .collect()
      : [];
    // Also include published admin-created courses
    const adminCourses = await ctx.db
      .query("courses")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
    // Merge, deduplicate by _id
    const seen = new Set(userCourses.map((c) => c._id));
    const merged = [...userCourses, ...adminCourses.filter((c) => !seen.has(c._id))];
    return merged;
  },
});

export const listWithProgress = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const userCourses = userId
      ? await ctx.db
          .query("courses")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .collect()
      : [];
    const adminCourses = await ctx.db
      .query("courses")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
    const seen = new Set(userCourses.map((c) => c._id));
    const allCourses = [...userCourses, ...adminCourses.filter((c) => !seen.has(c._id))];
    return Promise.all(
      allCourses.map(async (course) => {
        const lessons = await ctx.db
          .query("lessons")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();
        const completedCount = lessons.filter((l) => l.completed).length;
        return { ...course, completedCount, lessonCount: lessons.length };
      }),
    );
  },
});

export const get = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    return ctx.db.get(courseId);
  },
});

export const getLessons = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    return ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Must be signed in to create a course");
    return ctx.db.insert("courses", {
      ...args,
      userId,
      status: "generating",
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    courseId: v.id("courses"),
    status: v.union(
      v.literal("generating"),
      v.literal("ready"),
      v.literal("error")
    ),
  },
  handler: async (ctx, { courseId, status }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(courseId, { status });
  },
});

export const insertLesson = mutation({
  args: {
    courseId: v.id("courses"),
    lessonNumber: v.number(),
    title: v.string(),
    keyConcept: v.string(),
    content: v.optional(v.array(v.object({ heading: v.string(), body: v.string() }))),
    flashcards: v.array(v.object({ front: v.string(), back: v.string() })),
    quiz: v.array(
      v.object({
        question: v.string(),
        options: v.array(v.string()),
        correctAnswer: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db.insert("lessons", { ...args, completed: false });
  },
});

export const completeLesson = mutation({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, { lessonId }) => {
    await ctx.db.patch(lessonId, { completed: true });
  },
});

export const patchTitleAndDescription = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    description: v.string(),
    totalLessons: v.number(),
  },
  handler: async (ctx, { courseId, title, description, totalLessons }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(courseId, { title, description, totalLessons });
  },
});

export const clearLessons = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    await requireAdmin(ctx);
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    await Promise.all(lessons.map((l) => ctx.db.delete(l._id)));
  },
});

export const remove = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await getAuthUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found");
    // Admin-created courses can only be deleted from the admin panel (use deleteCourse)
    if (course.adminCreated) throw new Error("Use the admin panel to delete admin-created courses");
    if (course.userId !== userId) throw new Error("Not authorized");
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    await Promise.all(lessons.map((l) => ctx.db.delete(l._id)));
    await ctx.db.delete(courseId);
  },
});
