# Unloq Studio

Local-only admin tool: content browser, illustration review, video mode.

```
npm run studio   # from the repo root → http://127.0.0.1:5199
```

Needs `studio/.env.local` (gitignored) with `CONVEX_URL` and `CONVEX_DEPLOY_KEY` (production deploy key). The key stays in the local Vite server (`vite.config.ts`); the browser never sees it.
