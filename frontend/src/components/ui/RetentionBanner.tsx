import type { ReactNode } from 'react';

/** Shared “nudge” strip for Log / Progress (and similar) — matches `.retention-banner` in App.css */
export default function RetentionBanner({ children }: { children: ReactNode }) {
  return (
    <section className="app__card retention-banner" role="status" aria-live="polite">
      <p className="retention-banner__text">{children}</p>
    </section>
  );
}
