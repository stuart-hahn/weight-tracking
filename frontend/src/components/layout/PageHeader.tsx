import type { ReactNode } from 'react';

export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        <h2 className="page-header__title">{title}</h2>
        {description != null && <div className="page-header__desc">{description}</div>}
      </div>
      {actions != null && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

