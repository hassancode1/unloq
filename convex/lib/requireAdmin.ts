import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Throws if the caller is not an authenticated admin.
 * Admin emails are configured via the ADMIN_EMAILS Convex env var (comma-separated).
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) throw new Error("ADMIN_EMAILS env var not configured");
  const list = adminEmails.split(",").map((e) => e.trim().toLowerCase());
  if (!list.includes((user.email as string)?.toLowerCase() ?? "")) {
    throw new Error("Not authorized");
  }
}
