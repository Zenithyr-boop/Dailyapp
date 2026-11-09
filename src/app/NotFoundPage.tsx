import { Link } from 'react-router'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Not found" />
      <Panel>
        <p className="text-muted">That page doesn't exist.</p>
        <Link to="/quests" className="mt-3 inline-flex min-h-touch items-center font-display font-bold uppercase tracking-wider text-accent">
          Back to quests
        </Link>
      </Panel>
    </>
  )
}
