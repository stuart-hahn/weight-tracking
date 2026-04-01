interface EmptyStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <section className="ui-empty" role="status">
      {title && <h3 className="app__card-title ui-empty__title">{title}</h3>}
      <p className="progress-text ui-empty__message">{message}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn--secondary btn--touch ui-empty__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}

