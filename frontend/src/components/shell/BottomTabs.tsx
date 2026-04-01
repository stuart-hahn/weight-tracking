import type { Ref } from 'react';
import { NavLink } from 'react-router-dom';
import { primaryNavItems } from '../../navigation/nav';

export default function BottomTabs({
  onOpenMore,
  moreButtonRef,
}: {
  onOpenMore: () => void;
  moreButtonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <nav className="bottom-tabs" aria-label="Primary">
      {primaryNavItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          {...(item.end ? { end: true } : {})}
          className={({ isActive }) => `bottom-tabs__tab ${isActive ? 'bottom-tabs__tab--active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
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

