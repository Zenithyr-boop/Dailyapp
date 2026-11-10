import { Link } from 'react-router'
import { ComingSoon } from '../../components/ComingSoon'
import { ChevronRightIcon } from '../../components/icons'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { WorkoutsSection } from './workouts/WorkoutsSection'
import { ResumeBanner } from './sessions/ResumeBanner'
import { SessionHistory } from './sessions/SessionHistory'

export function TrainPage() {
  return (
    <>
      <PageHeader title="Train" />
      <div className="space-y-4">
        <ResumeBanner />
        <WorkoutsSection />
        <SessionHistory />
        <Panel title="Library">
          <Link to="/train/movements" className="group -my-2 flex min-h-touch items-center gap-3 py-2">
            <span className="flex-1">
              <span className="block font-display text-lg font-semibold uppercase tracking-wider group-hover:text-accent">
                Movement library
              </span>
              <span className="block text-sm text-muted">870+ movements with photos and instructions, plus your own</span>
            </span>
            <ChevronRightIcon size={18} className="text-faint group-hover:text-accent" />
          </Link>
        </Panel>
        <ComingSoon
          items={['Programs that schedule your workouts week by week']}
        />
      </div>
    </>
  )
}
