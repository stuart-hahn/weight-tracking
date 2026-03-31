import { NavLink } from 'react-router-dom';

interface NavProps {
  onLogout: () => void;
  email?: string | null;
}

export default function Nav({ onLogout, email }: NavProps) {
  const displayEmail = email ? (email.length > 20 ? `${email.slice(0, 18)}…` : email) : null;
  return (
    <nav className="app__nav" aria-label="Main">
      <NavLink to="/log" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`} end>
        Log
      </NavLink>
      <NavLink to="/workouts" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`}>
        Workouts
      </NavLink>
      <NavLink to="/exercises" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`}>
        Exercises
      </NavLink>
      <NavLink
        to="/workouts/programs"
        className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`}
      >
        Programs
      </NavLink>
      <NavLink to="/progress" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`}>
        Progress
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`}>
        Settings
      </NavLink>
      {displayEmail && (
        <span className="app__nav-email" style={{ fontSize: '0.8rem', color: 'var(--muted)', alignSelf: 'center', marginLeft: 'auto', marginRight: '0.5rem' }}>
          {displayEmail}
        </span>
      )}
      <button type="button" className="app__nav-link app__nav-link--btn" onClick={onLogout}>
        Sign out
      </button>
    </nav>
  );
}
