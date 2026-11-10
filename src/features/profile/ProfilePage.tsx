import { Link } from 'react-router'
import { SECONDARY_NAV } from '../../app/nav'
import { ChevronRightIcon } from '../../components/icons'
import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { AccountPanel } from './AccountPanel'
import { DATASET_URL } from '../train/library/dataset'
import { UnitToggle } from './UnitToggle'

export function ProfilePage() {
  return (
    <>
      <PageHeader title="Me" />
      <div className="space-y-4">
        <AccountPanel />
        <Panel title="Units">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted">Weights in kilograms or pounds. Rounded to real plate jumps.</p>
            <UnitToggle />
          </div>
        </Panel>
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
            'Goals: steps, sleep, water, calories, protein',
          ]}
        />
        <Panel title="About">
          <p className="text-muted">
            FromZero is free, built by a personal trainer. The core app stays free forever.
          </p>
          <h3 className="label mt-4">Credits</h3>
          <p className="mt-1 text-muted">
            Exercise data and photos:{' '}
            <a href={DATASET_URL} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2 hover:text-text">
              free-exercise-db
            </a>{' '}
            by yuhonas, released into the public domain (Unlicense).
          </p>
        </Panel>
      </div>
    </>
  )
}
