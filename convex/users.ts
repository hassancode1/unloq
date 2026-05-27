import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const currentUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db.get(userId);
  },
});

// Admin access: allow any authenticated user for now.
// Restrict by email whitelist by setting ADMIN_EMAILS env var (comma-separated).
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const user = await ctx.db.get(userId);
    if (!user) return false;
    const adminEmails = process.env.ADMIN_EMAILS;
    if (!adminEmails) {
      console.warn("[isAdmin] ADMIN_EMAILS env var is not set — all admin access denied. Set it in Convex dashboard env vars.");
      return false;
    }
    const list = adminEmails.split(",").map((e) => e.trim().toLowerCase());
    return list.includes((user.email as string)?.toLowerCase() ?? "");
  },
});
