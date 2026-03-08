interface PageLoadingProps {
  title?: string;
}

export default function PageLoading({ title }: PageLoadingProps) {
  return (
    <div aria-label={title ?? 'Loading'} aria-busy="true">
      {title && (
        <div className="app__card" style={{ marginBottom: '1rem' }}>
          <div className="skeleton skeleton-line" style={{ width: '8rem', height: '1.25rem', marginBottom: '0.75rem' }} aria-hidden />
          <div className="skeleton skeleton-line" style={{ width: '100%' }} aria-hidden />
          <div className="skeleton skeleton-line skeleton-line--short" aria-hidden />
        </div>
      )}
      <div className="app__card skeleton-card" aria-hidden />
      <div className="app__card skeleton-card" style={{ marginTop: '1rem' }} aria-hidden />
    </div>
  );
}
