import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/PageHeader'

export function ProgramsPage() {
  return (
    <>
      <PageHeader title="Programs" />
      <ComingSoon items={['66-day reset', '75-day challenge', 'Custom programs', 'Strict mode: miss a day, start over']} />
    </>
  )
}
