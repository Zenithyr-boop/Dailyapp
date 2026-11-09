import { NavLink } from 'react-router'
import type { NavItem } from '../app/nav'

function SideNavList({ items }: { items: NavItem[] }) {
  return (
    <ul>
      {items.map(({ to, label, Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-touch items-center gap-3 border-l-2 px-5 font-display text-base font-semibold uppercase tracking-wider ${
                isActive
                  ? 'border-accent bg-panel text-accent'
                  : 'border-transparent text-muted hover:bg-panel hover:text-text'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

/** Desktop left side nav. Hidden on mobile (tab bar takes over). */
export function SideNav({ primary, secondary }: { primary: NavItem[]; secondary: NavItem[] }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-bg md:flex"
    >
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="size-3 bg-accent" aria-hidden="true" />
        <span className="font-display text-2xl font-extrabold uppercase tracking-[0.14em]">Chalk</span>
      </div>
      <SideNavList items={primary} />
      <p className="label mt-6 mb-1 px-5">More</p>
      <SideNavList items={secondary} />
    </nav>
  )
}
