import { NavLink } from 'react-router-dom';
import { Home, LineChart, Settings, LogOut } from 'lucide-react';
import { copy } from '../copy';

interface NavProps {
  onLogout: () => void;
  email?: string | null;
}

const iconSize = 18;

export default function Nav({ onLogout, email }: NavProps) {
  const displayEmail = email ? (email.length > 20 ? `${email.slice(0, 18)}…` : email) : null;
  return (
    <nav className="app__nav" aria-label="Main">
      <div className="app__nav-main">
        <NavLink to="/home" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`} end aria-label="Home, log weight" title="Home">
          <Home size={iconSize} aria-hidden className="app__nav-icon" />
          Home
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`}>
          <LineChart size={iconSize} aria-hidden className="app__nav-icon" />
          History
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`}>
          <Settings size={iconSize} aria-hidden className="app__nav-icon" />
          Settings
        </NavLink>
      </div>
      <div className="app__nav-account">
        {displayEmail && (
          <span className="app__nav-email text-xs">
            {displayEmail}
          </span>
        )}
        <button type="button" className="app__nav-link app__nav-link--btn" onClick={onLogout}>
          <LogOut size={iconSize} aria-hidden className="app__nav-icon" />
          {copy.signOut}
        </button>
      </div>
    </nav>
  );
}
