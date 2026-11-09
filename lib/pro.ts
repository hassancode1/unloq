// Pro = explaining out loud (AI grading → Glim grows) + creating your own paths.
// With HARD_PAYWALL (lib/features.ts) the whole app needs Pro / the trial.
import { useAppStore } from '../store/useAppStore';

// openPaywall() shows the custom paywall (components/paywall/Paywall.tsx) as a
// modal via <PaywallHost/> and resolves when it closes.
let pending: ((unlocked: boolean) => void) | null = null;

/** Resolves true if they started a trial, bought, or restored. */
export function openPaywall(): Promise<boolean> {
  pending?.(false);
  return new Promise((resolve) => {
    pending = resolve;
    useAppStore.getState().setPaywallOpen(true);
  });
}

/** Called by PaywallHost when the modal closes. */
export function closePaywall(unlocked: boolean) {
  useAppStore.getState().setPaywallOpen(false);
  const r = pending;
  pending = null;
  r?.(unlocked);
}

/** After any trial start / purchase: offer to save Glim to an account. */
export function afterUnlock() {
  const st = useAppStore.getState();
  // First time in (no quests yet): Glim guides them through their first quest.
  if (Object.keys(st.questLog).length === 0) st.setGuidePending(true);
  st.setAskToSaveAccount(true);
}
