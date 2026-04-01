import type { ReactNode } from 'react';
import React from 'react';

type ErrorBoundaryProps = {
  title?: string;
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error('Unexpected error') };
  }

  componentDidCatch(error: Error) {
    // Keep console error for debugging; UI shows a safe message.
    // eslint-disable-next-line no-console
    console.error(error);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="app__card" role="alert" aria-label="Page error">
          <h2 className="app__card-title">{this.props.title ?? 'Something went wrong'}</h2>
          <p className="progress-text" style={{ marginBottom: '0.5rem' }}>
            The page crashed while rendering. Try reloading. If it persists, copy the error below.
          </p>
          <pre
            className="progress-text"
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
            }}
          >
            {this.state.error.message}
          </pre>
        </section>
      );
    }

    return this.props.children;
  }
}

