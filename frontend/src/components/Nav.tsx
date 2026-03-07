import { NavLink } from 'react-router-dom';

interface NavProps {
  onLogout: () => void;
}

export default function Nav({ onLogout }: NavProps) {
  return (
    <nav className="app__nav" aria-label="Main">
      <NavLink to="/log" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`} end>
        Log
      </NavLink>
      <NavLink to="/progress" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`}>
        Progress
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `app__nav-link ${isActive ? 'app__nav-link--active' : ''}`}>
        Settings
      </NavLink>
      <button type="button" className="app__nav-link app__nav-link--btn" onClick={onLogout}>
        Sign out
      </button>
    </nav>
  );
}
