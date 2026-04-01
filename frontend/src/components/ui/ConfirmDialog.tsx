import type { ReactNode, RefObject } from 'react';
import Dialog from './Dialog';

type ConfirmVariant = 'default' | 'danger';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  busy = false,
  onConfirm,
  onClose,
  initialFocusRef,
}: {
  open: boolean;
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      description={message}
      onClose={busy ? () => {} : onClose}
      closeOnBackdrop={!busy}
      size="sm"
      {...(initialFocusRef ? { initialFocusRef } : {})}
    >
      <div className="ui-dialog__actions">
        <button
          type="button"
          className={variant === 'danger' ? 'btn btn--danger' : 'btn btn--primary'}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button type="button" className="btn btn--secondary" disabled={busy} onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </Dialog>
  );
}

