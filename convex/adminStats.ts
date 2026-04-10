import { query } from "./_generated/server";

export const getAdminStats = query({
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    const allCourses = await ctx.db.query("courses").collect();
    const allLessons = await ctx.db.query("lessons").collect();

    const completedLessons = allLessons.filter((l) => l.completed);

    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Build new users per day for last 7 days
    const dayMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dayMap[d] = 0;
    }

    // Per-course stats
    const publishedCourses = allCourses.filter((c) => c.published && c.adminCreated);
    const courseStats = publishedCourses.map((course) => {
      const courseLessons = allLessons.filter((l) => l.courseId === course._id);
      const completedCourseLessons = courseLessons.filter((l) => l.completed);
      return {
        courseId: course._id,
        title: course.title,
        enrollments: 0,
        completions: 0,
        averageProgress:
          courseLessons.length > 0
            ? Math.round((completedCourseLessons.length / courseLessons.length) * 100)
            : 0,
      };
    });

    return {
      users: {
        total: allUsers.length,
        activeToday: 0,
        activeThisWeek: 0,
        newUsersLast7Days: Object.entries(dayMap).map(([date, count]) => ({ date, count })),
      },
      lessons: {
        totalCompleted: completedLessons.length,
        averageQuizScore: null,
      },
      courses: courseStats,
    };
  },
});
