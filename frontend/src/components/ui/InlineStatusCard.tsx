interface InlineStatusCardProps {
  variant: 'error' | 'info';
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function InlineStatusCard({
  variant,
  title,
  message,
  actionLabel,
  onAction,
}: InlineStatusCardProps) {
  return (
    <section
      className={`app__card ui-inline-status ui-inline-status--${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      {title && <h3 className="app__card-title ui-inline-status__title">{title}</h3>}
      <p className="progress-text ui-inline-status__message">{message}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn--secondary btn--touch ui-inline-status__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}

