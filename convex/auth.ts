import { convexAuth, createAccount } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";

function decodeBase64Url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  return atob(pad ? padded + '='.repeat(4 - pad) : padded);
}

// Verifies an Apple identity token (JWT) against Apple's public JWKS and
// returns the stable subject + email.
async function verifyAppleIdentityToken(
  identityToken: string,
  bundleId: string,
): Promise<{ sub: string; email?: string }> {
  const parts = identityToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed Apple identity token');
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(decodeBase64Url(headerB64));
  const payload = JSON.parse(decodeBase64Url(payloadB64));

  if (payload.iss !== 'https://appleid.apple.com') throw new Error('Invalid token issuer');
  if (payload.aud !== bundleId) throw new Error('Invalid token audience');
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Apple token expired');

  const jwksRes = await fetch('https://appleid.apple.com/auth/keys');
  const { keys } = (await jwksRes.json()) as { keys: JsonWebKey[] };
  const jwk = (keys as any[]).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Apple signing key not found');

  const publicKey = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify'],
  );
  const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sigBytes = Uint8Array.from(decodeBase64Url(sigB64), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, sigBytes, dataBytes);
  if (!valid) throw new Error('Apple token signature invalid');

  return { sub: payload.sub as string, email: payload.email as string | undefined };
}

const AppleNative = ConvexCredentials({
  id: 'apple-native',
  async authorize(credentials, ctx) {
    const identityToken = credentials.identityToken as string;
    const fallbackEmail = credentials.email as string | undefined;

    const { sub, email } = await verifyAppleIdentityToken(identityToken, 'com.loqlearn.app');

    const resolvedEmail = email ?? fallbackEmail;
    const result = await createAccount(ctx, {
      provider: 'apple-native',
      account: { id: sub },
      profile: resolvedEmail ? { email: resolvedEmail } : {},
    });
    return { userId: result.user._id };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google, AppleNative, Password],
});
