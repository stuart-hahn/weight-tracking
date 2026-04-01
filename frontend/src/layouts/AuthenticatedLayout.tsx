import AppShell from '../components/shell/AppShell';

interface AuthenticatedLayoutProps {
  onLogout: () => void;
  email?: string | null;
}

export default function AuthenticatedLayout({ onLogout, email }: AuthenticatedLayoutProps) {
  return (
    <AppShell email={email ?? null} onLogout={onLogout} />
  );
}

