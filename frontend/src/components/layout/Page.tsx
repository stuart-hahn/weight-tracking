import type { ReactNode } from 'react';

export default function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `page ${className}` : 'page'}>{children}</div>;
}

