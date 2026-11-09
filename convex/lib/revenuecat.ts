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
    const ent = data?.subscriber?.entitlements?.[ENTITLEMENT];
    if (!ent) return false;
    // null expiry = lifetime; trials count (they have a future expiry).
    return !ent.expires_date || new Date(ent.expires_date).getTime() > Date.now();
  } catch (e) {
    console.warn("RevenueCat lookup error", e instanceof Error ? e.message : e);
    return true;
  }
}
