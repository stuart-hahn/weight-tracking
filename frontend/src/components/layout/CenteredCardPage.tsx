import type { ReactNode } from 'react';
import Page from './Page';
import PageHeader from './PageHeader';

export default function CenteredCardPage({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Page>
      <PageHeader title={title} description={description} />
      <section className="app__card">{children}</section>
      {footer != null && <div className="centered-card-page__footer">{footer}</div>}
    </Page>
  );
}

