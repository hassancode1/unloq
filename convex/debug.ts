import { query } from "./_generated/server";

export const myLessonSummary = query({
  handler: async (ctx) => {

    const courses = await ctx.db.query("courses").collect();

    const rows = await Promise.all(
      courses.map(async (course) => {
        const lessons = await ctx.db
          .query("lessons")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();

        const completed = lessons.filter((l) => l.completed).length;

        return {
          courseId: course._id,
          userId: course.userId ?? "no-user",
          title: course.title,
          status: course.status,
          totalLessons_field: course.totalLessons,
          actual_lesson_records: lessons.length,
          completed,
          duplicated: lessons.length > course.totalLessons,
        };
      }),
    );

    return {
      totalCourses: courses.length,
      totalLessonsCompleted: rows.reduce((s, r) => s + r.completed, 0),
      courses: rows,
    };
  },
});
