import { ComingSoon } from '../../components/ComingSoon'
import { PageHeader } from '../../components/PageHeader'

export function FoodPage() {
  return (
    <>
      <PageHeader title="Food" />
      <ComingSoon
        items={[
          'Daily calories and macros against your targets',
          'Barcode lookup (Open Food Facts)',
          'Quick add and recent foods',
          'Water tracking',
        ]}
      />
    </>
  )
}
