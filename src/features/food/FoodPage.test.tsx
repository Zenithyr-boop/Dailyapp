import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { db } from '../../lib/db'
import { addDays, toDayKey } from '../../lib/dates'
import { ensureSetup } from '../quests/questsRepo'
import { AddFoodPage } from './AddFoodPage'
import { FoodPage } from './FoodPage'
import { logPortion } from './foodLogRepo'
import { portionOf, type Food } from './nutrition'

const banana: Food = {
  id: 'usda-173944',
  source: 'usda',
  name: 'Banana',
  per100: { kcal: 89, proteinG: 1.09, carbsG: 22.8, fatG: 0.33 },
  servings: [{ label: '1 medium', grams: 118 }],
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/food', element: <FoodPage /> },
      { path: '/food/add', element: <AddFoodPage /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureSetup()
  await db.profile.update('me', { goals: { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 } })
})

describe('Food tab', { timeout: 15_000 }, () => {
  it('shows the day’s totals against the targets and each meal', async () => {
    await logPortion(toDayKey(), 'breakfast', portionOf(banana, { grams: 200 }))
    renderAt('/food')
    expect(await screen.findByRole('progressbar', { name: /Calories: 178 of 2,000 kcal, 1,822 kcal left/ })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /Protein: 2\.2 of 150 g/ })).toBeInTheDocument()
    const breakfast = screen.getByRole('region', { name: 'Breakfast' })
    expect(within(breakfast).getByText('Banana')).toBeInTheDocument()
    expect(within(breakfast).getByText('178 kcal')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Dinner' })).getByText('Nothing logged.')).toBeInTheDocument()
  })

  it('copies yesterday into today', async () => {
    await logPortion(addDays(toDayKey(), -1), 'lunch', portionOf(banana, { grams: 100 }))
    renderAt('/food')
    fireEvent.click(await screen.findByRole('button', { name: /Copy yesterday \(1 food\)/ }))
    expect(await screen.findByText('Copied 1 food from the day before.')).toBeInTheDocument()
    expect(await within(screen.getByRole('region', { name: 'Lunch' })).findByText('Banana')).toBeInTheDocument()
  })

  it('edits and removes an entry', async () => {
    await logPortion(toDayKey(), 'snacks', portionOf(banana, { grams: 100 }))
    renderAt('/food')
    fireEvent.click(await screen.findByRole('button', { name: /Banana/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Banana' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove from log' }))
    expect(await within(screen.getByRole('region', { name: 'Snacks' })).findByText('Nothing logged.')).toBeInTheDocument()
    expect((await db.food.toArray())[0]?.deleted).toBe(1)
  })
})

describe('Add food', { timeout: 15_000 }, () => {
  it('finds a bundled food as you type and logs it by servings', async () => {
    renderAt('/food/add?meal=lunch')
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Search foods' }), { target: { value: 'banan' } })
    const results = await screen.findByRole('region', { name: 'Foods' })
    fireEvent.click(await within(results).findByRole('button', { name: /^Banana/ }, { timeout: 5000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Banana' })
    expect(within(dialog).getByLabelText('Unit')).toHaveDisplayValue('1 medium (118 g)')
    fireEvent.change(within(dialog).getByLabelText('Servings'), { target: { value: '2' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to Lunch' }))
    expect(await screen.findByText(/Added Banana \(210 kcal\) to Lunch/)).toBeInTheDocument()
    const [entry] = await db.food.toArray()
    expect(entry).toMatchObject({ meal: 'lunch', grams: 236, servings: 2, kcal: 210, foodId: 'usda-173944' })
  })

  it('logs a quick add with calories worked out from the macros', async () => {
    renderAt('/food/add?meal=dinner&quick=1')
    const dialog = await screen.findByRole('dialog', { name: 'Quick add' })
    fireEvent.change(within(dialog).getByLabelText('Protein (g)'), { target: { value: '30' } })
    fireEvent.change(within(dialog).getByLabelText('Fat (g)'), { target: { value: '10' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }))
    expect(await screen.findByText(/Added Quick add \(210 kcal\) to Dinner/)).toBeInTheDocument()
  })

  it('only asks Open Food Facts when the user submits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ count: 0, products: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      renderAt('/food/add')
      const search = await screen.findByRole('searchbox', { name: 'Search foods' })
      fireEvent.change(search, { target: { value: 'granola bar' } })
      await screen.findByRole('region', { name: 'Foods' })
      expect(fetchMock).not.toHaveBeenCalled()
      fireEvent.submit(search.closest('form')!)
      expect(await screen.findByText(/No packaged foods found/)).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
