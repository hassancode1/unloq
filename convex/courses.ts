import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("courses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const listWithProgress = query({
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").order("desc").collect();
    return Promise.all(
      courses.map(async (course) => {
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
    await ctx.db.patch(courseId, { title, description, totalLessons });
  },
});

export const remove = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await getAuthUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) throw new Error("Not authorized");
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    await Promise.all(lessons.map((l) => ctx.db.delete(l._id)));
    await ctx.db.delete(courseId);
  },
});
