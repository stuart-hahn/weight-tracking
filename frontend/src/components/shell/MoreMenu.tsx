import type { RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { moreNavItems } from '../../navigation/nav';

function useOnClickOutside(
  refs: Array<RefObject<HTMLElement | null>>,
  onOutside: () => void,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      for (const r of refs) {
        const el = r.current;
        if (el && el.contains(t)) return;
      }
      onOutside();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [refs, onOutside, enabled]);
}

export default function MoreMenu({
  open,
  onClose,
  anchorRef,
  email,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLButtonElement | null>;
  email: string | null;
  onLogout: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLAnchorElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number; opacity: number }>({ top: 0, left: 0, opacity: 0 });

  useOnClickOutside([menuRef, anchorRef], onClose, open);

  const menuItems = useMemo(
    () => ['[role="menuitem"]'],
    []
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => firstItemRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      requestAnimationFrame(() => anchorRef.current?.focus());
      void prev;
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;

      const menu = menuRef.current;
      if (!menu) return;
      const items = Array.from(menu.querySelectorAll<HTMLElement>(menuItems[0]));
      if (items.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const idx = active ? items.indexOf(active) : -1;
      const nextIdx = (() => {
        if (e.key === 'Home') return 0;
        if (e.key === 'End') return items.length - 1;
        if (e.key === 'ArrowDown') return idx < 0 ? 0 : (idx + 1) % items.length;
        if (e.key === 'ArrowUp') return idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length;
        return 0;
      })();

      e.preventDefault();
      items[nextIdx]?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const place = () => {
      const a = anchor.getBoundingClientRect();
      const m = menu.getBoundingClientRect();
      const margin = 8;

      const preferBelow = a.bottom + margin + m.height <= window.innerHeight - margin;
      const top = preferBelow ? a.bottom + margin : Math.max(margin, a.top - margin - m.height);

      const idealLeft = a.right - m.width;
      const left = Math.max(margin, Math.min(window.innerWidth - margin - m.width, idealLeft));

      setPosition({ top: Math.round(top), left: Math.round(left), opacity: 1 });
    };

    // Render pass first so we can measure the menu.
    setPosition((p) => ({ ...p, opacity: 0 }));
    const id = requestAnimationFrame(() => place());

    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', place);
    };
  }, [open, anchorRef]);

  if (!open) return null;

  const displayEmail = email ? (email.length > 28 ? `${email.slice(0, 26)}…` : email) : null;

  return (
    <div
      ref={menuRef}
      className="more-menu"
      role="menu"
      aria-label="More"
      style={{ top: position.top, left: position.left, opacity: position.opacity }}
    >
      {displayEmail && <div className="more-menu__email" aria-label="Signed in as">{displayEmail}</div>}

      {moreNavItems.map((item, idx) => (
        <Link
          // Keep first-item focus behavior.
          ref={idx === 0 ? firstItemRef : undefined}
          key={item.to}
          to={item.to}
          role="menuitem"
          className="more-menu__item"
        >
          {item.label}
        </Link>
      ))}

      <button
        type="button"
        className="more-menu__item more-menu__item--danger"
        role="menuitem"
        onClick={() => {
          onClose();
          onLogout();
        }}
      >
        Sign out
      </button>
    </div>
  );
}

