// Backend for Unloq Studio (studio/ — a local-only admin web tool). Everything
// here is internal: only callable with the deployment's deploy key, which lives
// in studio/.env.local on the owner's Mac and never reaches a browser.
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/** Counts for the overview. */
export const overview = internalQuery({
  handler: async (ctx) => {
    const paths = await ctx.db.query("paths").withIndex("by_curated", (q) => q.eq("curated", true)).collect();
    const reading: Record<string, number> = {};
    const illustration: Record<string, number> = { none: 0 };
    let topics = 0;
    for (const p of paths) {
      for (const t of await ctx.db.query("pathTopics").withIndex("by_path_order", (q) => q.eq("pathId", p._id)).collect()) {
        topics++;
        reading[t.status] = (reading[t.status] ?? 0) + 1;
        const s = t.illustration?.status ?? "none";
        illustration[s] = (illustration[s] ?? 0) + 1;
      }
    }
    const custom = (await ctx.db.query("paths").withIndex("by_curated", (q) => q.eq("curated", false)).collect()).length;
    return { paths: paths.length, topics, reading, illustration, customPaths: custom };
  },
});

/** Every curated path with a light summary of its topics (no readings). */
export const paths = internalQuery({
  handler: async (ctx) => {
    const rows = await ctx.db.query("paths").withIndex("by_curated", (q) => q.eq("curated", true)).collect();
    rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const out = [];
    for (const p of rows) {
      const topics = await ctx.db.query("pathTopics").withIndex("by_path_order", (q) => q.eq("pathId", p._id)).collect();
      out.push({
        _id: p._id, title: p.title, subtitle: p.subtitle, interest: p.interest, trending: !!p.trending, color: p.color ?? null,
        topics: topics.map((t) => ({
          _id: t._id, order: t.order, title: t.title, concept: t.concept ?? null, status: t.status,
          illustration: t.illustration?.status ?? null,
        })),
      });
    }
    return out;
  },
});

/** One topic in full, for the content browser. */
export const topic = internalQuery({
  args: { topicId: v.id("pathTopics") },
  handler: async (ctx, { topicId }) => {
    const t = await ctx.db.get(topicId);
    if (!t) return null;
    const p = await ctx.db.get(t.pathId);
    return {
      _id: t._id, order: t.order, title: t.title, concept: t.concept ?? null, summary: t.summary, status: t.status,
      reading: t.reading ?? null, points: t.points ?? [], keyIdeas: t.keyIdeas ?? [], sources: t.sources ?? [],
      pathTitle: p?.title ?? "", color: p?.color ?? null,
      illustration: t.illustration
        ? { status: t.illustration.status, brief: t.illustration.brief, url: await ctx.storage.getUrl(t.illustration.storageId) }
        : null,
    };
  },
});

/** Every curated illustration, waiting ones first (the review grid). */
export const illustrations = internalQuery({
  handler: async (ctx) => {
    const rows = [];
    for (const p of await ctx.db.query("paths").withIndex("by_curated", (q) => q.eq("curated", true)).collect()) {
      for (const t of await ctx.db.query("pathTopics").withIndex("by_path_order", (q) => q.eq("pathId", p._id)).collect()) {
        if (!t.illustration) continue;
        rows.push({
          topicId: t._id, title: t.title, concept: t.concept ?? null, pathTitle: p.title,
          status: t.illustration.status, brief: t.illustration.brief,
          url: await ctx.storage.getUrl(t.illustration.storageId),
        });
      }
    }
    const rank = { review: 0, rejected: 1, approved: 2 } as const;
    return rows.sort((a, b) => rank[a.status] - rank[b.status]);
  },
});

export const setIllustrationStatus = internalMutation({
  args: { topicId: v.id("pathTopics"), status: v.union(v.literal("approved"), v.literal("rejected"), v.literal("review")) },
  handler: async (ctx, { topicId, status }) => {
    const t = await ctx.db.get(topicId);
    if (!t?.illustration) return;
    await ctx.db.patch(topicId, { illustration: { ...t.illustration, status } });
  },
});

/** Clears one reading so it's rewritten (the studio then calls pathsAi:ensureReading). */
export const resetReading = internalMutation({
  args: { topicId: v.id("pathTopics") },
  handler: async (ctx, { topicId }) => {
    await ctx.db.patch(topicId, {
      reading: undefined, hook: undefined, points: undefined, figure: undefined,
      keyIdeas: undefined, keywords: undefined, sources: undefined, status: "pending",
    });
  },
});
