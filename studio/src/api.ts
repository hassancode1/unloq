// Every Convex call goes through the local Vite server (vite.config.ts), which
// holds the deploy key. Names must be on its allow-list.
export async function call<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/api/call', { method: 'POST', body: JSON.stringify({ name, args }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.result as T;
}
