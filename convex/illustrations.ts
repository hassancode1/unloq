// Explainer illustrations for curated topics: storage, the review gallery
// (admins only, ADMIN_EMAILS), and the list the batch script works through.
// Generation itself is pathsAi:illustrate (a Node action).
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/requireAdmin";

export const _forIllustration = internalQuery({
  args: { topicId: v.id("pathTopics") },
  handler: async (ctx, { topicId }) => {
    const t = await ctx.db.get(topicId);
    if (!t) return null;
    const path = await ctx.db.get(t.pathId);
    if (!path?.curated) return null; // curated only: custom paths stay text-only
    return { title: t.title, concept: t.concept ?? null, summary: t.summary, reading: t.reading ?? null, pathTitle: path.title, color: path.color ?? null };
  },
});

export const _save = internalMutation({
  args: { topicId: v.id("pathTopics"), storageId: v.id("_storage"), brief: v.string() },
  handler: async (ctx, { topicId, storageId, brief }) => {
    const t = await ctx.db.get(topicId);
    if (!t) return;
    if (t.illustration) await ctx.storage.delete(t.illustration.storageId).catch(() => {});
    await ctx.db.patch(topicId, { illustration: { storageId, brief, status: "review", createdAt: Date.now() } });
  },
});

/** Curated topics that still need an image (none yet, or rejected). For the batch script. */
export const _todo = internalQuery({
  handler: async (ctx) => {
    const out: string[] = [];
    for (const p of await ctx.db.query("paths").withIndex("by_curated", (q) => q.eq("curated", true)).collect()) {
      for (const t of await ctx.db.query("pathTopics").withIndex("by_path_order", (q) => q.eq("pathId", p._id)).collect()) {
        if (!t.illustration || t.illustration.status === "rejected") out.push(t._id);
      }
    }
    return out;
  },
});

/** Review gallery: every curated topic's illustration, waiting ones first. */
export const listForReview = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
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

export const setStatus = mutation({
  args: { topicId: v.id("pathTopics"), status: v.union(v.literal("approved"), v.literal("rejected"), v.literal("review")) },
  handler: async (ctx, { topicId, status }) => {
    await requireAdmin(ctx);
    const t = await ctx.db.get(topicId);
    if (!t?.illustration) return;
    await ctx.db.patch(topicId, { illustration: { ...t.illustration, status } });
  },
});

/** "Approve all I've looked at": every image still waiting for review. */
export const approveAllWaiting = mutation({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    let n = 0;
    for (const t of await ctx.db.query("pathTopics").collect()) {
      if (t.illustration?.status !== "review") continue;
      await ctx.db.patch(t._id, { illustration: { ...t.illustration, status: "approved" } });
      n++;
    }
    return { approved: n };
  },
});

/** CLI helper: illustration URLs + briefs (no auth; internal only). */
export const _peek = internalQuery({
  args: { topicIds: v.array(v.id("pathTopics")) },
  handler: async (ctx, { topicIds }) => {
    const out = [];
    for (const id of topicIds) {
      const t = await ctx.db.get(id);
      if (!t?.illustration) continue;
      out.push({ title: t.title, status: t.illustration.status, brief: t.illustration.brief, url: await ctx.storage.getUrl(t.illustration.storageId) });
    }
    return out;
  },
});

/** CLI helper: approve every waiting image (e.g. after reviewing them elsewhere). */
export const _approveAll = internalMutation({
  handler: async (ctx) => {
    let n = 0;
    for (const t of await ctx.db.query("pathTopics").collect()) {
      if (t.illustration?.status !== "review") continue;
      await ctx.db.patch(t._id, { illustration: { ...t.illustration, status: "approved" } });
      n++;
    }
    return { approved: n };
  },
});
