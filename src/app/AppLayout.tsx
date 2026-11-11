import { Outlet, useMatches } from 'react-router'
import { SideNav } from '../components/SideNav'
import { TabBar } from '../components/TabBar'
import { PRIMARY_NAV, SECONDARY_NAV } from './nav'

/** App shell: side nav (desktop) or bottom tab bar (mobile) around the page. */
export function AppLayout() {
  const wide = useMatches().some((m) => (m.handle as { wide?: boolean } | undefined)?.wide)
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30 focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
      >
        Skip to content
      </a>
      {/* Android (edge to edge): keeps scrolled content out from under the status bar. 0 high elsewhere. */}
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-bg" />
      <SideNav primary={PRIMARY_NAV} secondary={SECONDARY_NAV} />
      <main
        id="main"
        className="mx-auto w-full max-w-3xl px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pl-[calc(15rem+2rem)] md:pr-8 md:pt-[calc(2.5rem+env(safe-area-inset-top))] md:pb-12 md:max-w-none lg:pr-12"
      >
        <div className={wide ? 'md:max-w-6xl' : 'md:max-w-3xl'}>
          <Outlet />
        </div>
      </main>
      <TabBar items={PRIMARY_NAV} />
    </div>
  )
}
