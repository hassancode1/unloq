// Renders the paywall as a modal when openPaywall() is called (in-app unlocks,
// soft-paywall mode). Mount once, inside the Convex provider.
import React from 'react';
import { Modal } from 'react-native';
import { closePaywall } from '../../lib/pro';
import { useAppStore } from '../../store/useAppStore';
import Paywall from './Paywall';

export default function PaywallHost() {
  const open = useAppStore((s) => s.paywallOpen);
  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => closePaywall(false)}>
      {open && <Paywall onClose={() => closePaywall(false)} onUnlocked={() => closePaywall(true)} />}
    </Modal>
  );
}

/**
 * The paywall as a modal you render *inside* another modal (iOS can't present
 * a sibling modal while one is open) — e.g. the quest screen, the paths sheet.
 */
export function PaywallModal({ visible, onClose, onUnlocked }: {
  visible: boolean; onClose: () => void; onUnlocked: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {visible && <Paywall onClose={onClose} onUnlocked={onUnlocked} />}
    </Modal>
  );
}
