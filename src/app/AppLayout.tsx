import { Outlet } from 'react-router'
import { SideNav } from '../components/SideNav'
import { TabBar } from '../components/TabBar'
import { PRIMARY_NAV, SECONDARY_NAV } from './nav'

/** App shell: side nav (desktop) or bottom tab bar (mobile) around the page. */
export function AppLayout() {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30 focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
      >
        Skip to content
      </a>
      <SideNav primary={PRIMARY_NAV} secondary={SECONDARY_NAV} />
      <main
        id="main"
        className="mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pl-[calc(15rem+2rem)] md:pr-8 md:pt-10 md:pb-12 md:max-w-none lg:pr-12"
      >
        <div className="md:max-w-3xl">
          <Outlet />
        </div>
      </main>
      <TabBar items={PRIMARY_NAV} />
    </div>
  )
}
