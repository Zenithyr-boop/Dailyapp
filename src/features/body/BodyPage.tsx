import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/PageHeader'

export function BodyPage() {
  return (
    <>
      <PageHeader title="Body" />
      <ComingSoon
        items={['Body weight log and trend', 'Steps and sleep (Health Connect on Android)', 'Measurements']}
      />
    </>
  )
}
