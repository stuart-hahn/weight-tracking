import { Outlet } from 'react-router-dom';
import Nav from '../components/Nav';

interface AuthenticatedLayoutProps {
  onLogout: () => void;
  email?: string | null;
}

export default function AuthenticatedLayout({ onLogout, email }: AuthenticatedLayoutProps) {
  return (
    <>
      <Nav onLogout={onLogout} email={email ?? null} />
      <Outlet />
    </>
  );
}

