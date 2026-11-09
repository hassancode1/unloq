// Account backup for the learning state that lives on the device: Glim,
// quest log, followed paths. The app merges on sign-in (lib/progressSync.ts)
// and pushes changes back, so Glim survives a new phone or a reinstall.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ~1–2 KB per quest with saved feedback; stays well under Convex's 1 MB document limit.
const MAX_BYTES = 900_000;

export const mine = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db.query("progress").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    return row ? { data: row.data, updatedAt: row.updatedAt } : null;
  },
});

export const save = mutation({
  args: { data: v.any(), updatedAt: v.number() },
  handler: async (ctx, { data, updatedAt }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    if (JSON.stringify(data).length > MAX_BYTES) throw new Error("Progress too large");
    const row = await ctx.db.query("progress").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (row) await ctx.db.patch(row._id, { data, updatedAt });
    else await ctx.db.insert("progress", { userId, data, updatedAt });
  },
});
