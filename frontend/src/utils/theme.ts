const THEME_KEY = 'body_fat_tracker_theme';

export type ThemePreference = 'system' | 'light' | 'dark';

export function getStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (preference === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', preference);
  }
  syncThemeColor();
}

/** Updates the theme-color meta tag to match current --bg for browser chrome. */
export function syncThemeColor(): void {
  if (typeof document === 'undefined') return;
  requestAnimationFrame(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      meta.setAttribute('content', bg || '#0f172a');
    }
  });
}

export function setTheme(preference: ThemePreference): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_KEY, preference);
  applyTheme(preference);
}
