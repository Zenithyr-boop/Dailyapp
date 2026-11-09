import { NavLink } from 'react-router'
import type { NavItem } from '../app/nav'

/** Mobile bottom tab bar. Hidden on desktop (side nav takes over). */
export function TabBar({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-panel-edge bg-panel md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex min-h-14 flex-col items-center justify-center gap-0.5 font-display text-[11px] font-semibold uppercase tracking-[0.1em] ${
                  isActive
                    ? 'text-accent before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:bg-accent'
                    : 'text-muted hover:text-text'
                }`
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
