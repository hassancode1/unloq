// Unloq Studio — local only. The Vite dev server holds the Convex deploy key
// (studio/.env.local, gitignored) and makes every Convex call on the Node side
// at POST /api/call; the browser never sees the key. Only allow-listed
// functions can be called.
import react from '@vitejs/plugin-react';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const ALLOWED: Record<string, 'query' | 'mutation' | 'action'> = {
  'studio:overview': 'query',
  'studio:paths': 'query',
  'studio:topic': 'query',
  'studio:illustrations': 'query',
  'studio:setIllustrationStatus': 'mutation',
  'studio:resetReading': 'mutation',
  'pathsAi:ensureReading': 'action',
  'pathsAi:illustrate': 'action',
};

function convexProxy(env: Record<string, string>): Plugin {
  const url = env.CONVEX_URL;
  const key = env.CONVEX_DEPLOY_KEY;
  return {
    name: 'unloq-convex-proxy',
    configureServer(server) {
      // Images from Convex storage, fetched here (the browser's own requests to
      // storage can stall) and kept in memory. Only Convex hosts are allowed.
      const images = new Map<string, { type: string; body: Buffer }>();
      server.middlewares.use('/api/img', async (req, res) => {
        const u = (new URL(req.url ?? '', 'http://x').searchParams.get('u') ?? '').trim();
        let host = '';
        try { host = new URL(u).host; } catch {}
        if (!host.endsWith('.convex.cloud') && !host.endsWith('.convex.site')) { res.statusCode = 400; return res.end('bad url'); }
        let hit = images.get(u);
        if (!hit) {
          for (let attempt = 0; attempt < 3 && !hit; attempt++) {
            try {
              const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
              if (r.ok) hit = { type: r.headers.get('content-type') ?? 'image/webp', body: Buffer.from(await r.arrayBuffer()) };
            } catch {}
          }
          if (!hit) { res.statusCode = 502; return res.end('image failed'); }
          images.set(u, hit);
        }
        res.setHeader('Content-Type', hit.type);
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.end(hit.body);
      });
      server.middlewares.use('/api/call', async (req, res) => {
        const send = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (!url || !key) return send(500, { error: 'Set CONVEX_URL and CONVEX_DEPLOY_KEY in studio/.env.local' });
        let raw = '';
        for await (const chunk of req) raw += chunk;
        try {
          const { name, args } = JSON.parse(raw || '{}');
          const kind = ALLOWED[name];
          if (!kind) return send(403, { error: `Not allowed: ${name}` });
          const client = new ConvexHttpClient(url);
          (client as any).setAdminAuth(key);
          const ref = makeFunctionReference(name) as any;
          const result = await (client as any)[kind](ref, args ?? {});
          send(200, { result });
        } catch (e) {
          send(500, { error: e instanceof Error ? e.message : String(e) });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ''); // non-VITE_ vars stay on the server
  return {
    plugins: [react(), convexProxy(env)],
    server: { host: '127.0.0.1', port: 5199, fs: { allow: ['..'] } }, // this Mac only; shares ../lib and ../assets
  };
});
