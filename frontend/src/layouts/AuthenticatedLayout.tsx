import AppShell from '../components/shell/AppShell';
import { TimeZonePreferenceProvider } from '../context/TimeZonePreference';

interface AuthenticatedLayoutProps {
  userId: string;
  onLogout: () => void;
  email?: string | null;
}

export default function AuthenticatedLayout({ userId, onLogout, email }: AuthenticatedLayoutProps) {
  return (
    <TimeZonePreferenceProvider userId={userId}>
      <AppShell email={email ?? null} onLogout={onLogout} />
    </TimeZonePreferenceProvider>
  );
}

