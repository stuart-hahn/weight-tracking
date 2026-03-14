import { NavLink } from 'react-router-dom';

interface NavProps {
  onLogout: () => void;
  email?: string | null;
}

export default function Nav({ onLogout, email }: NavProps) {
  const displayEmail = email ? (email.length > 20 ? `${email.slice(0, 18)}…` : email) : null;
  return (
    <nav className="app__nav" aria-label="Main">
      <div className="app__nav-main">
        <NavLink to="/log" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`} end aria-label="Log weight, add entry" title="Add weight">
          Log
        </NavLink>
        <NavLink to="/progress" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`}>
          Progress
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`}>
          Settings
        </NavLink>
      </div>
      <div className="app__nav-account">
        {displayEmail && (
          <span className="app__nav-email" style={{ fontSize: '0.8rem', color: 'var(--muted)', marginRight: '0.25rem' }}>
            {displayEmail}
          </span>
        )}
        <button type="button" className="app__nav-link app__nav-link--btn" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
