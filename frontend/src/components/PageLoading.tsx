interface PageLoadingProps {
  title?: string;
}

export default function PageLoading({ title }: PageLoadingProps) {
  return (
    <section className="app__card" aria-label={title ?? 'Loading'}>
      {title && <h2 className="app__card-title">{title}</h2>}
      <p className="progress-text">Loading…</p>
    </section>
  );
}
