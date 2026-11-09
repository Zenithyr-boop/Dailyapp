import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/PageHeader'

export function CommunityPage() {
  return (
    <>
      <PageHeader title="Community" />
      <ComingSoon items={['Share your workouts', 'Browse and copy workouts from others']} />
    </>
  )
}
