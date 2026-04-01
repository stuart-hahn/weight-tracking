export type NavItem = {
  /** Canonical route path. */
  to: string;
  /** Human label used in navigation. */
  label: string;
  /** Page title used in the shell header. */
  title: string;
  /** When true, uses exact match semantics for active state. */
  end?: boolean;
};

export const primaryNavItems: NavItem[] = [
  { to: '/log', label: 'Log', title: 'Log', end: true },
  { to: '/progress', label: 'Progress', title: 'Progress' },
  { to: '/workouts', label: 'Workouts', title: 'Workouts' },
];

export const moreNavItems: NavItem[] = [
  { to: '/exercises', label: 'Exercises', title: 'Exercises' },
  { to: '/workouts/programs', label: 'Programs', title: 'Programs' },
  { to: '/settings', label: 'Settings', title: 'Settings' },
];

const EXERCISE_HISTORY_PATH = /^\/exercises\/[^/]+\/history\/?$/;

export function getPageTitle(pathname: string): string {
  if (EXERCISE_HISTORY_PATH.test(pathname)) {
    return 'Exercise history';
  }
  for (const item of [...primaryNavItems, ...moreNavItems]) {
    if (item.to === pathname) return item.title;
    if (item.to !== '/' && pathname.startsWith(`${item.to}/`)) return item.title;
  }

  if (pathname.startsWith('/workouts/')) return 'Workout session';
  if (pathname === '/onboarding') return 'Onboarding';
  return 'Body Fat Tracker';
}

