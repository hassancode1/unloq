// Tiny sound-effects helper on top of expo-audio.
// Ticks fire up to ~20×/s while the dial spins, so they rotate through a small pool.
// expo-audio is loaded lazily: if the native module isn't in this build yet
// (e.g. an old dev client), sounds are silently skipped instead of crashing.
import type { AudioPlayer } from 'expo-audio';
import { requireOptionalNativeModule } from 'expo-modules-core';

const TICK = require('../assets/sounds/tick.wav');
const REVEAL = require('../assets/sounds/reveal.wav');

let ready = false;
let ticks: AudioPlayer[] = [];
let tickIdx = 0;
let reveal: AudioPlayer | null = null;

export function loadSfx() {
  if (ready) return;
  ready = true;
  // Old dev builds don't contain ExpoAudio — check first, because Metro reports
  // a failed require as an error even when it's caught.
  if (!requireOptionalNativeModule('ExpoAudio')) return;
  try {
    const { createAudioPlayer, setAudioModeAsync } = require('expo-audio') as typeof import('expo-audio');
    // Respect the silent switch; mix with whatever the user is listening to.
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    ticks = Array.from({ length: 4 }, () => {
      const p = createAudioPlayer(TICK);
      p.volume = 0.55;
      return p;
    });
    reveal = createAudioPlayer(REVEAL);
    reveal.volume = 0.8;
  } catch {
    ticks = [];
    reveal = null;
  }
}

function fire(p: AudioPlayer | null | undefined) {
  if (!p) return;
  try { p.seekTo(0); p.play(); } catch {}
}

export function playTick() {
  if (!ticks.length) return;
  fire(ticks[tickIdx]);
  tickIdx = (tickIdx + 1) % ticks.length;
}

export function playReveal() {
  fire(reveal);
}

export function unloadSfx() {
  for (const p of ticks) { try { p.remove(); } catch {} }
  try { reveal?.remove(); } catch {}
  ticks = [];
  reveal = null;
  ready = false;
}

// ── Glim's reaction sounds ─────────────────────────────────────────────────────
// Silent until files are added. To add one: put a short .wav/.mp3 (under ~0.5 s)
// in assets/sounds/ and uncomment its line, e.g.
//   boing: require('../assets/sounds/boing.wav'),
export type ReactionSound = 'boing' | 'splat' | 'bloop' | 'gulp' | 'sparkle';
const REACTION_SOUNDS: Partial<Record<ReactionSound, number>> = {
  // boing:   require('../assets/sounds/boing.wav'),   // jump launch
  // splat:   require('../assets/sounds/splat.wav'),   // landing in a puddle
  // bloop:   require('../assets/sounds/bloop.wav'),   // pulling back together
  // gulp:    require('../assets/sounds/gulp.wav'),    // absorbing a fact
  // sparkle: require('../assets/sounds/sparkle.wav'), // the ripple of light
};
const reactionPlayers: Partial<Record<ReactionSound, AudioPlayer | null>> = {};

export function playReaction(name: ReactionSound, volume = 0.7) {
  const src = REACTION_SOUNDS[name];
  if (!src) return;
  if (!(name in reactionPlayers)) {
    if (!requireOptionalNativeModule('ExpoAudio')) { reactionPlayers[name] = null; return; }
    try {
      const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
      const p = createAudioPlayer(src);
      p.volume = volume;
      reactionPlayers[name] = p;
    } catch { reactionPlayers[name] = null; }
  }
  fire(reactionPlayers[name]);
}
