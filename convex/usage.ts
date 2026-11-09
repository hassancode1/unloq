// Daily counters: rate limits for the public demo grader and AI cost caps.
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Count one use of each key, but only if every key is still under its limit
 * (all-or-nothing). Returns false — and counts nothing — when any is full.
 */
export const _take = internalMutation({
  args: { buckets: v.array(v.object({ key: v.string(), limit: v.number() })) },
  handler: async (ctx, { buckets }) => {
    const day = today();
    const rows = await Promise.all(
      buckets.map((b) =>
        ctx.db.query("usage").withIndex("by_key_day", (q) => q.eq("key", b.key).eq("day", day)).unique(),
      ),
    );
    if (buckets.some((b, i) => (rows[i]?.count ?? 0) >= b.limit)) return false;
    await Promise.all(
      buckets.map((b, i) => {
        const row = rows[i];
        return row
          ? ctx.db.patch(row._id, { count: row.count + 1 })
          : ctx.db.insert("usage", { key: b.key, day, count: 1 });
      }),
    );
    return true;
  },
});
