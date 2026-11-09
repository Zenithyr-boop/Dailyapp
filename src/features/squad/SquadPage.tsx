import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/PageHeader'

export function SquadPage() {
  return (
    <>
      <PageHeader title="Squad" />
      <ComingSoon
        items={['Add friends', 'Squads with a shared weekly goal', 'See who cleared their quests today']}
      />
    </>
  )
}
