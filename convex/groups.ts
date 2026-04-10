import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listGroups = query({
  handler: async (ctx) => {
    return ctx.db
      .query("groups")
      .order("asc")
      .collect();
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("groups").collect();
    const sort_order = existing.length;
    return ctx.db.insert("groups", { ...args, sort_order });
  },
});

export const updateGroup = mutation({
  args: {
    id: v.id("groups"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, description }) => {
    await ctx.db.patch(id, { name, description });
  },
});

export const deleteGroup = mutation({
  args: { id: v.id("groups") },
  handler: async (ctx, { id }) => {
    // Unlink courses from this group
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_group", (q) => q.eq("group_id", id))
      .collect();
    await Promise.all(courses.map((c) => ctx.db.patch(c._id, { group_id: undefined })));
    await ctx.db.delete(id);
  },
});

export const reorderGroups = mutation({
  args: {
    items: v.array(v.object({ id: v.id("groups"), sort_order: v.number() })),
  },
  handler: async (ctx, { items }) => {
    await Promise.all(items.map(({ id, sort_order }) => ctx.db.patch(id, { sort_order })));
  },
});
