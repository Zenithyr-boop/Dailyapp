import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/PageHeader'

export function TrainPage() {
  return (
    <>
      <PageHeader title="Train" />
      <ComingSoon
        items={[
          'Saved workout templates',
          'Log sessions set by set: kg, reps, RPE',
          'Movement library',
          'History and personal records',
        ]}
      />
    </>
  )
}
