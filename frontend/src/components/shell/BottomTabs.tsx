import type { Ref } from 'react';
import { NavLink } from 'react-router-dom';

export default function BottomTabs({
  onOpenMore,
  moreButtonRef,
}: {
  onOpenMore: () => void;
  moreButtonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <nav className="bottom-tabs" aria-label="Primary">
      <NavLink
        to="/log"
        end
        className={({ isActive }) => `bottom-tabs__tab ${isActive ? 'bottom-tabs__tab--active' : ''}`}
      >
        Log
      </NavLink>
      <NavLink
        to="/progress"
        className={({ isActive }) => `bottom-tabs__tab ${isActive ? 'bottom-tabs__tab--active' : ''}`}
      >
        Progress
      </NavLink>
      <NavLink
        to="/workouts"
        className={({ isActive }) => `bottom-tabs__tab ${isActive ? 'bottom-tabs__tab--active' : ''}`}
      >
        Workouts
      </NavLink>
      <button
        ref={moreButtonRef}
        type="button"
        className="bottom-tabs__tab bottom-tabs__tab--btn"
        onClick={onOpenMore}
        aria-haspopup="menu"
      >
        More
      </button>
    </nav>
  );
}

