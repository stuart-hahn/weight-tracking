import type { ReactNode, RefObject } from 'react';
import { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { flushSync } from 'react-dom';

type DialogSize = 'sm' | 'md';

function getFocusable(root: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((el) => {
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return !el.hasAttribute('disabled');
  });
}

export default function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  initialFocusRef,
  closeOnBackdrop = true,
  size = 'md',
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdrop?: boolean;
  size?: DialogSize;
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const backdropArmedRef = useRef(false);

  // Stable instance id for aria-controls relationships if needed later.
  const instanceId = useMemo(() => `dialog-${titleId}`, [titleId]);

  useEffect(() => {
    if (!open) return;
    lastActiveRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = getFocusable(panel);
      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const idx = active ? focusable.indexOf(active) : -1;
      const nextIdx = e.shiftKey ? (idx <= 0 ? focusable.length - 1 : idx - 1) : (idx === focusable.length - 1 ? 0 : idx + 1);
      e.preventDefault();
      focusable[nextIdx]?.focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    // Prevent background scrolling while open.
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    // Disarm backdrop close until after the opening gesture completes.
    backdropArmedRef.current = false;
    const armId = requestAnimationFrame(() => {
      backdropArmedRef.current = true;
    });

    // Focus initial element (or first focusable).
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const initial = initialFocusRef?.current ?? null;
      if (initial) {
        initial.focus();
        return;
      }
      if (!panel) return;
      const focusable = getFocusable(panel);
      (focusable[0] ?? panel).focus();
    });

    return () => {
      cancelAnimationFrame(armId);
      cancelAnimationFrame(id);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (open) return;
    const el = lastActiveRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      try {
        el.focus();
      } catch {
        // ignore
      }
    });
  }, [open]);

  if (!open) return null;

  // Ensure portal target exists in environments where body may be null.
  const target = typeof document !== 'undefined' ? document.body : null;
  if (!target) return null;

  return createPortal(
    <div
      className="ui-dialog"
      data-dialog-id={instanceId}
      role="presentation"
      onClick={(e) => {
        if (!closeOnBackdrop) return;
        if (!backdropArmedRef.current) return;
        if (e.target === e.currentTarget) {
          // Flush close so focus restore feels immediate.
          flushSync(() => onClose());
        }
      }}
    >
      <div
        className={size === 'sm' ? 'ui-dialog__panel ui-dialog__panel--sm' : 'ui-dialog__panel'}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description != null ? descId : undefined}
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="ui-dialog__header">
          <h2 className="ui-dialog__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="ui-dialog__close btn btn--secondary btn--sm" onClick={onClose} aria-label="Close dialog">
            Close
          </button>
        </header>
        {description != null && (
          <div className="ui-dialog__desc" id={descId}>
            {description}
          </div>
        )}
        <div className="ui-dialog__body">{children}</div>
      </div>
    </div>,
    target
  );
}

