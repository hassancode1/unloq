// Learning paths: curated + user-created series of daily topics.
// Content is public (anyone can browse curated paths, even before signing in);
// per-user progress lives on the device for now.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { CURATED_PATHS } from "./curatedPaths";

const pathSummary = (p: any) => ({
  _id: p._id, slug: p.slug, title: p.title, subtitle: p.subtitle, interest: p.interest,
  curated: p.curated, status: p.status, topicCount: p.topicCount, trending: !!p.trending,
  sigil: p.sigil ?? null, color: p.color ?? null,
});

const topicPublic = (t: any) => ({
  _id: t._id, pathId: t.pathId, order: t.order, title: t.title, concept: t.concept ?? null, summary: t.summary,
  reading: t.reading ?? null, hook: t.hook ?? null, points: t.points ?? [], keyIdeas: t.keyIdeas ?? [], keywords: t.keywords ?? [],
  sources: t.sources ?? [], status: t.status,
});

// ── Queries ───────────────────────────────────────────────────────────────────

export const listCurated = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("paths").withIndex("by_curated", (q) => q.eq("curated", true)).collect();
    return rows
      .filter((p) => p.status === "ready")
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(pathSummary);
  },
});

export const listMine = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db.query("paths").withIndex("by_owner", (q) => q.eq("ownerId", userId)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).map(pathSummary);
  },
});

/** Path + its outline (no readings) for the path detail screen. */
export const getPath = query({
  args: { pathId: v.id("paths") },
  handler: async (ctx, { pathId }) => {
    const path = await ctx.db.get(pathId);
    if (!path) return null;
    if (!path.curated) {
      const userId = await getAuthUserId(ctx);
      if (path.ownerId !== userId) return null;
    }
    const topics = await ctx.db.query("pathTopics").withIndex("by_path_order", (q) => q.eq("pathId", pathId)).collect();
    return { ...pathSummary(path), topics: topics.map((t) => ({ _id: t._id, order: t.order, title: t.title, concept: t.concept ?? null, summary: t.summary })) };
  },
});

/**
 * Topics for the wheel: the next step of each requested path.
 * `progress` is the device's state: [{ pathId, order }].
 */
export const nextTopics = query({
  args: { progress: v.array(v.object({ pathId: v.id("paths"), order: v.number() })) },
  handler: async (ctx, { progress }) => {
    const userId = await getAuthUserId(ctx);
    const out = [];
    for (const { pathId, order } of progress.slice(0, 12)) {
      const path = await ctx.db.get(pathId);
      if (!path || path.status !== "ready") continue;
      if (!path.curated && path.ownerId !== userId) continue;
      const topic = await ctx.db
        .query("pathTopics")
        .withIndex("by_path_order", (q) => q.eq("pathId", pathId).eq("order", order))
        .unique();
      if (!topic) continue; // path finished
      out.push({ path: pathSummary(path), topic: topicPublic(topic) });
    }
    return out;
  },
});

export const getTopic = query({
  args: { topicId: v.id("pathTopics") },
  handler: async (ctx, { topicId }) => {
    const t = await ctx.db.get(topicId);
    if (!t) return null;
    // custom paths are private: only their owner can read their topics
    const path = await ctx.db.get(t.pathId);
    if (!path) return null;
    if (!path.curated && path.ownerId !== (await getAuthUserId(ctx))) return null;
    return topicPublic(t);
  },
});

// ── Internal helpers used by the AI actions ──────────────────────────────────

/** Dev helper: find a topic by (part of) its title. */
export const _findTopic = internalQuery({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const all = await ctx.db.query("pathTopics").collect();
    return all.filter((t) => t.title.toLowerCase().includes(q.toLowerCase())).map((t) => ({ _id: t._id, title: t.title, status: t.status }));
  },
});

export const _topicWithPath = internalQuery({
  args: { topicId: v.id("pathTopics") },
  handler: async (ctx, { topicId }) => {
    const topic = await ctx.db.get(topicId);
    if (!topic) return null;
    const path = await ctx.db.get(topic.pathId);
    if (!path) return null;
    const prev = topic.order > 0
      ? await ctx.db.query("pathTopics").withIndex("by_path_order", (q) => q.eq("pathId", topic.pathId).eq("order", topic.order - 1)).unique()
      : null;
    return { topic, path, prevTitle: prev?.title ?? null };
  },
});

/** Claims a pending topic for generation. Returns false if someone else already is. */
export const _claimTopic = internalMutation({
  args: { topicId: v.id("pathTopics") },
  handler: async (ctx, { topicId }) => {
    const t = await ctx.db.get(topicId);
    if (!t || t.status === "ready" || t.status === "generating") return false;
    await ctx.db.patch(topicId, { status: "generating" });
    return true;
  },
});

export const _saveTopic = internalMutation({
  args: {
    topicId: v.id("pathTopics"),
    reading: v.string(),
    hook: v.optional(v.string()),
    points: v.array(v.string()),
    keyIdeas: v.array(v.string()),
    keywords: v.array(v.array(v.string())),
    sources: v.array(v.string()),
  },
  handler: async (ctx, { topicId, ...rest }) => {
    await ctx.db.patch(topicId, { ...rest, status: "ready" });
  },
});

/** Clears a topic's reading so the next person to open it gets a fresh one. */
export const _resetReading = internalMutation({
  args: { topicId: v.id("pathTopics"), title: v.optional(v.string()), concept: v.optional(v.string()) },
  handler: async (ctx, { topicId, title, concept }) => {
    await ctx.db.patch(topicId, {
      ...(title ? { title } : {}), ...(concept ? { concept } : {}),
      reading: undefined, hook: undefined, points: undefined,
      keyIdeas: undefined, keywords: undefined, sources: undefined, status: "pending",
    });
  },
});

export const _failTopic = internalMutation({
  args: { topicId: v.id("pathTopics") },
  handler: async (ctx, { topicId }) => {
    await ctx.db.patch(topicId, { status: "error" });
  },
});

export const _createCustomPath = internalMutation({
  args: { ownerId: v.id("users"), prompt: v.string() },
  handler: async (ctx, { ownerId, prompt }) => {
    return await ctx.db.insert("paths", {
      slug: `custom-${Date.now()}`,
      title: prompt.slice(0, 60),
      subtitle: "Building your path…",
      interest: "custom",
      curated: false,
      ownerId,
      prompt,
      status: "outlining",
      topicCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const _finishCustomPath = internalMutation({
  args: {
    pathId: v.id("paths"),
    title: v.string(),
    subtitle: v.string(),
    interest: v.string(),
    topics: v.array(v.object({ title: v.string(), concept: v.optional(v.string()), summary: v.string() })),
  },
  handler: async (ctx, { pathId, title, subtitle, interest, topics }) => {
    for (let i = 0; i < topics.length; i++) {
      await ctx.db.insert("pathTopics", { pathId, order: i, ...topics[i], status: "pending" });
    }
    await ctx.db.patch(pathId, { title, subtitle, interest, status: "ready", topicCount: topics.length });
  },
});

export const _failCustomPath = internalMutation({
  args: { pathId: v.id("paths") },
  handler: async (ctx, { pathId }) => {
    await ctx.db.patch(pathId, { status: "error", subtitle: "Couldn’t build this path. Try rewording it." });
  },
});

export const _countCustomPaths = internalQuery({
  args: { ownerId: v.id("users") },
  handler: async (ctx, { ownerId }) => {
    const rows = await ctx.db.query("paths").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
    return rows.filter((p) => p.status !== "error").length;
  },
});

export const deleteCustomPath = mutation({
  args: { pathId: v.id("paths") },
  handler: async (ctx, { pathId }) => {
    const userId = await getAuthUserId(ctx);
    const path = await ctx.db.get(pathId);
    if (!path || path.curated || path.ownerId !== userId) throw new Error("Not allowed");
    const topics = await ctx.db.query("pathTopics").withIndex("by_path_order", (q) => q.eq("pathId", pathId)).collect();
    for (const t of topics) await ctx.db.delete(t._id);
    await ctx.db.delete(pathId);
  },
});

// ── Seeding ───────────────────────────────────────────────────────────────────

/**
 * Creates curated paths that don't exist yet and appends any new topics.
 * Renames topics whose outline changed and clears their reading (regenerated on open).
 * Run: npx convex run paths:seedCurated
 */
export const seedCurated = internalMutation({
  handler: async (ctx) => {
    let created = 0, added = 0, renamed = 0;
    for (let i = 0; i < CURATED_PATHS.length; i++) {
      const c = CURATED_PATHS[i];
      let path = await ctx.db.query("paths").withIndex("by_slug", (q) => q.eq("slug", c.slug)).unique();
      if (!path) {
        const id = await ctx.db.insert("paths", {
          slug: c.slug, title: c.title, subtitle: c.subtitle, interest: c.interest,
          trending: !!c.trending, sigil: c.sigil, color: c.color, curated: true, status: "ready", topicCount: 0, sortOrder: i, createdAt: Date.now(),
        });
        path = (await ctx.db.get(id))!;
        created++;
      } else {
        await ctx.db.patch(path._id, { title: c.title, subtitle: c.subtitle, interest: c.interest, trending: !!c.trending, sigil: c.sigil, color: c.color, icon: undefined, sortOrder: i });
      }
      const existing = await ctx.db.query("pathTopics").withIndex("by_path_order", (q) => q.eq("pathId", path!._id)).collect();
      // Outline edits. Progress is stored by position (order), so renaming is safe.
      // A changed title or brief means the old reading no longer matches: clear it
      // and the next person to open the topic gets a fresh one.
      for (const t of existing) {
        const want = c.topics[t.order];
        if (!want || t.status === "generating") continue;
        const contentChanged = t.title !== want.title || t.summary !== want.summary;
        if (!contentChanged && t.concept === want.concept) continue;
        await ctx.db.patch(t._id, {
          title: want.title, concept: want.concept, summary: want.summary,
          ...(contentChanged && t.status !== "pending"
            ? { reading: undefined, hook: undefined, points: undefined, keyIdeas: undefined, keywords: undefined, sources: undefined, status: "pending" as const }
            : {}),
        });
        if (contentChanged) renamed++;
      }
      for (let k = existing.length; k < c.topics.length; k++) {
        await ctx.db.insert("pathTopics", { pathId: path._id, order: k, ...c.topics[k], status: "pending" });
        added++;
      }
      await ctx.db.patch(path._id, { topicCount: Math.max(existing.length, c.topics.length) });
    }
    return { created, added, renamed };
  },
});
