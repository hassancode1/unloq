import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { DEMO_FACTS } from '../../convex/lib/demoFacts';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface Interest {
  id: string;
  label: string;
  icon: IconName;
  /** The "teach Glim" fact for onboarding (shared with the server grader). */
  fact: { title: string; body: string };
}

export const INTERESTS: Interest[] = [
  {
    id: 'space', label: 'Space', icon: 'planet-outline',
    fact: DEMO_FACTS.space,
  },
  {
    id: 'history', label: 'History', icon: 'hourglass-outline',
    fact: DEMO_FACTS.history,
  },
  {
    id: 'psychology', label: 'Psychology', icon: 'happy-outline',
    fact: DEMO_FACTS.psychology,
  },
  {
    id: 'money', label: 'Money', icon: 'trending-up-outline',
    fact: DEMO_FACTS.money,
  },
  {
    id: 'science', label: 'Science', icon: 'flask-outline',
    fact: DEMO_FACTS.science,
  },
  {
    id: 'philosophy', label: 'Philosophy', icon: 'infinite-outline',
    fact: DEMO_FACTS.philosophy,
  },
  {
    id: 'tech', label: 'Tech', icon: 'hardware-chip-outline',
    fact: DEMO_FACTS.tech,
  },
  {
    id: 'health', label: 'Health', icon: 'heart-outline',
    fact: DEMO_FACTS.health,
  },
  {
    id: 'art', label: 'Art', icon: 'color-palette-outline',
    fact: DEMO_FACTS.art,
  },
  {
    id: 'languages', label: 'Languages', icon: 'chatbubbles-outline',
    fact: DEMO_FACTS.languages,
  },
  {
    id: 'nature', label: 'Nature', icon: 'leaf-outline',
    fact: DEMO_FACTS.nature,
  },
];

export const SCROLL_WINDOWS = [
  { id: 'morning',   label: 'Right after waking', icon: 'sunny-outline' as IconName,      time: '08:00' },
  { id: 'commute',   label: 'On my commute',      icon: 'train-outline' as IconName,      time: '08:30' },
  { id: 'lunch',     label: 'Lunch break',        icon: 'restaurant-outline' as IconName, time: '12:30' },
  { id: 'afternoon', label: 'Afternoon slump',    icon: 'cafe-outline' as IconName,       time: '16:00' },
  { id: 'evening',   label: 'Evenings',           icon: 'tv-outline' as IconName,         time: '19:30' },
  { id: 'bed',       label: 'In bed',             icon: 'moon-outline' as IconName,       time: '22:00' },
];

export const MINUTE_OPTIONS = [
  { value: 5,  label: '5 min',  sub: 'Casual' },
  { value: 10, label: '10 min', sub: 'Regular' },
  { value: 15, label: '15 min', sub: 'Serious' },
  { value: 20, label: '20 min', sub: 'Obsessed' },
];

export function hoursMood(h: number) {
  if (h <= 1) return 'Impressive.';
  if (h <= 3) return 'Pretty normal.';
  if (h <= 5) return 'That adds up.';
  if (h <= 7) return 'That’s a lot.';
  return 'Glim is worried.';
}
