import { Link } from 'react-router'
import { SECONDARY_NAV } from '../../app/nav'
import { ChevronRightIcon } from '../../components/icons'
import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { AccountPanel } from './AccountPanel'

export function ProfilePage() {
  return (
    <>
      <PageHeader title="Me" />
      <div className="space-y-4">
        <AccountPanel />
        {/* On mobile these screens have no tab, so link them here. */}
        <Panel title="More" className="md:hidden">
          <ul className="-my-2">
            {SECONDARY_NAV.map(({ to, label, Icon }) => (
              <li key={to} className="border-b border-line-soft last:border-b-0">
                <Link to={to} className="flex min-h-touch items-center gap-3 py-2 hover:text-accent">
                  <Icon size={20} className="text-muted" />
                  <span className="flex-1 font-display text-lg font-semibold uppercase tracking-wider">
                    {label}
                  </span>
                  <ChevronRightIcon size={18} className="text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <ComingSoon
          items={[
            'Profile, level and rank history',
            'Units: metric / imperial',
            'Goals: steps, sleep, water, calories, protein',
            'Sync across devices when signed in',
          ]}
        />
      </div>
    </>
  )
}
