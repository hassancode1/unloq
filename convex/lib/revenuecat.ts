// Server-side Pro check against RevenueCat (the app logs users into RevenueCat
// with their Convex user id). Set the secret key with:
//   npx convex env set REVENUECAT_SECRET_KEY sk_...
// Without a key (e.g. local dev) everyone is treated as Pro, and if RevenueCat
// is unreachable we fail open — never block someone who paid.

const ENTITLEMENT = "premium";

export async function hasPro(userId: string): Promise<boolean> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) return true;
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.warn("RevenueCat lookup failed", res.status);
      return true;
    }
    const data: any = await res.json();
    const now = Date.now();
    const live = (x: any) => !!x && (!x.expires_date || new Date(x.expires_date).getTime() > now);
    // Same rule as the app (hooks/useEntitlement.ts): the "premium" entitlement,
    // or any active subscription — so a product that isn't attached to the
    // entitlement in RevenueCat still counts. Trials have a future expiry.
    if (live(data?.subscriber?.entitlements?.[ENTITLEMENT])) return true;
    const subs = Object.values(data?.subscriber?.subscriptions ?? {}) as any[];
    return subs.some((sub) => live(sub) && !sub.refunded_at);
  } catch (e) {
    console.warn("RevenueCat lookup error", e instanceof Error ? e.message : e);
    return true;
  }
}
