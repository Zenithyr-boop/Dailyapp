import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { db } from '../../lib/db'
import { addDays, dayKeyAt } from '../../lib/day'
import { ensureSetup } from '../quests/questsRepo'
import { AddFoodPage } from './AddFoodPage'
import { FoodPage } from './FoodPage'
import { logPortion } from './foodLogRepo'
import { mealForTime, mealName, portionOf, type Food } from './nutrition'

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

async function quickLog(text: string) {
  const box = await screen.findByRole('textbox', { name: 'Log food' })
  fireEvent.change(box, { target: { value: text } })
  fireEvent.submit(box.closest('form')!)
}

const liveEntries = async () => (await db.food.toArray()).filter((e) => !e.deleted)

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureSetup()
  await db.profile.update('me', { goals: { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 } })
})

describe('Food tab', { timeout: 15_000 }, () => {
  it('shows the day’s totals against the targets and each meal', async () => {
    await logPortion(dayKeyAt(), 'breakfast', portionOf(banana, { grams: 200 }))
    renderAt('/food')
    expect(await screen.findByRole('progressbar', { name: /Calories: 178 of 2,000 kcal, 1,822 kcal left/ })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /Protein: 2\.2 of 150 g/ })).toBeInTheDocument()
    const breakfast = screen.getByRole('region', { name: 'Breakfast' })
    expect(within(breakfast).getByText('Banana')).toBeInTheDocument()
    expect(within(breakfast).getByText('178 kcal')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Dinner' })).getByText('Nothing logged.')).toBeInTheDocument()
  })

  it('copies yesterday into today', async () => {
    await logPortion(addDays(dayKeyAt(), -1), 'lunch', portionOf(banana, { grams: 100 }))
    renderAt('/food')
    fireEvent.click(await screen.findByRole('button', { name: /Copy yesterday \(1 food\)/ }))
    expect(await screen.findByText('Copied 1 food from the day before.')).toBeInTheDocument()
    expect(await within(screen.getByRole('region', { name: 'Lunch' })).findByText('Banana')).toBeInTheDocument()
  })

  it('edits and removes an entry', async () => {
    await logPortion(dayKeyAt(), 'snacks', portionOf(banana, { grams: 100 }))
    renderAt('/food')
    fireEvent.click(await within(await screen.findByRole('region', { name: 'Snacks' })).findByRole('button', { name: /Banana/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Banana' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove from log' }))
    expect(await within(screen.getByRole('region', { name: 'Snacks' })).findByText('Nothing logged.')).toBeInTheDocument()
    expect((await db.food.toArray())[0]?.deleted).toBe(1)
  })
})

describe('Quick log', { timeout: 15_000 }, () => {
  it('logs “chicken and rice 500” to the meal for the time of day, with Undo', async () => {
    renderAt('/food')
    await quickLog('chicken and rice 500')
    const meal = mealForTime()
    expect(await screen.findByText(/Logged/)).toHaveTextContent(`Logged Chicken and rice · 500 kcal to ${mealName(meal)}.`)
    const [entry] = await liveEntries()
    expect(entry).toMatchObject({ name: 'Chicken and rice', kcal: 500, meal, missing: ['proteinG', 'carbsG', 'fatG'] })
    expect(entry?.foodId).toBeUndefined()
    // Totals count the calories and say quietly that macros are missing.
    expect(await screen.findByRole('progressbar', { name: /Calories: 500 of 2,000 kcal/ })).toBeInTheDocument()
    expect(screen.getByText(/1 entry has no macros/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('Removed Chicken and rice.')).toBeInTheDocument()
    expect(await liveEntries()).toEqual([])
  })

  it('picks up macros and lets the meal be changed in one tap', async () => {
    renderAt('/food')
    const box = await screen.findByRole('textbox', { name: 'Log food' })
    fireEvent.change(box, { target: { value: 'burrito bowl 650 kcal 45p 70c 18f' } })
    fireEvent.click(within(await screen.findByRole('group', { name: 'Log to' })).getByRole('button', { name: 'Dinner' }))
    fireEvent.submit(box.closest('form')!)
    expect(await screen.findByText(/Logged/)).toHaveTextContent('to Dinner.')
    const [entry] = await liveEntries()
    expect(entry).toMatchObject({ name: 'Burrito bowl', meal: 'dinner', kcal: 650, proteinG: 45, carbsG: 70, fatG: 18 })
    expect(entry?.missing).toBeUndefined()
    expect(screen.queryByRole('button', { name: 'Add macros' })).not.toBeInTheDocument()
  })

  it('adds macros to an entry later', async () => {
    renderAt('/food')
    await quickLog('lasagna 650')
    fireEvent.click(await screen.findByRole('button', { name: 'Add macros' }))
    const dialog = await screen.findByRole('dialog', { name: 'Lasagna' })
    fireEvent.change(within(dialog).getByLabelText('Protein (g)'), { target: { value: '35' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await liveEntries())[0]).toMatchObject({ proteinG: 35, missing: ['carbsG', 'fatG'] }))
  })

  it('saves a quick log for next time as a custom food (Undo removes both)', async () => {
    renderAt('/food')
    const box = await screen.findByRole('textbox', { name: 'Log food' })
    fireEvent.change(box, { target: { value: "Mom's lasagna 650" } })
    fireEvent.click(await screen.findByRole('checkbox', { name: /Save for next time/ }))
    fireEvent.submit(box.closest('form')!)
    await screen.findByText(/Logged/)
    const [food] = await db.foods.toArray()
    expect(food).toMatchObject({ name: "Mom's lasagna", per100: { kcal: 650 }, servings: [{ label: '1 serving', grams: 100, nominal: true }] })
    const [entry] = await liveEntries()
    expect(entry).toMatchObject({ foodId: food!.id, kcal: 650, servings: 1 })

    // It shows up in search as the user's own food.
    fireEvent.change(box, { target: { value: 'moms lasag' } })
    expect(await within(await screen.findByRole('list', { name: 'Matching foods' })).findByRole('button', { name: /Mom's lasagna/ })).toBeInTheDocument()

    fireEvent.change(box, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await db.foods.toArray())[0]?.deleted).toBe(1))
  })

  it('logs a search result’s usual serving in one tap, then adjusts the amount', async () => {
    renderAt('/food')
    const box = await screen.findByRole('textbox', { name: 'Log food' })
    fireEvent.change(box, { target: { value: 'banan' } })
    const results = await screen.findByRole('list', { name: 'Matching foods' }, { timeout: 5000 })
    const row = await within(results).findByRole('button', { name: /^Banana\s*1 medium · 105 kcal/ }, { timeout: 5000 })
    expect(row).toHaveTextContent('Whole food')
    fireEvent.click(row)
    await screen.findByText(/Logged/)
    expect((await liveEntries())[0]).toMatchObject({ foodId: 'usda-173944', servings: 1, grams: 118, kcal: 105 })

    fireEvent.click(screen.getByRole('button', { name: 'Adjust amount' }))
    const dialog = await screen.findByRole('dialog', { name: 'Banana' })
    fireEvent.change(within(dialog).getByLabelText('Servings'), { target: { value: '2' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await liveEntries())[0]).toMatchObject({ servings: 2, kcal: 210 }))
  })
})

describe('Add food', { timeout: 15_000 }, () => {
  it('finds a bundled food as you type and logs it in one tap', async () => {
    renderAt('/food/add?meal=lunch')
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Search foods' }), { target: { value: 'banan' } })
    const results = await screen.findByRole('region', { name: 'Foods' })
    fireEvent.click(await within(results).findByRole('button', { name: /^Banana\s*1 medium/ }, { timeout: 5000 }))
    expect(await screen.findByText(/Logged/)).toHaveTextContent('Logged Banana · 105 kcal to Lunch.')
    const [entry] = await db.food.toArray()
    expect(entry).toMatchObject({ meal: 'lunch', grams: 118, servings: 1, kcal: 105, foodId: 'usda-173944' })
  })

  it('logs a quick log with calories worked out from the macros', async () => {
    renderAt('/food/add?meal=dinner&quick=1')
    const dialog = await screen.findByRole('dialog', { name: 'Quick log' })
    fireEvent.change(within(dialog).getByLabelText('Protein (g)'), { target: { value: '30' } })
    fireEvent.change(within(dialog).getByLabelText('Fat (g)'), { target: { value: '10' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }))
    expect(await screen.findByText(/Logged/)).toHaveTextContent('Logged Quick log · 210 kcal to Dinner.')
    expect((await db.food.toArray())[0]).toMatchObject({ proteinG: 30, fatG: 10, missing: ['carbsG'] })
  })

  it('only asks Open Food Facts when asked, or on Enter when nothing else matches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ count: 0, products: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      renderAt('/food/add')
      const search = await screen.findByRole('searchbox', { name: 'Search foods' })
      // Something on the device matches: Enter doesn't go online.
      fireEvent.change(search, { target: { value: 'granola bar' } })
      await within(await screen.findByRole('region', { name: 'Foods' })).findAllByRole('button', { name: /Granola bar/ }, { timeout: 5000 })
      fireEvent.submit(search.closest('form')!)
      expect(fetchMock).not.toHaveBeenCalled()
      // Nothing matches: Enter searches packaged foods.
      fireEvent.change(search, { target: { value: 'zqxv crunch' } })
      await screen.findByText(/Nothing on your device matches/)
      expect(fetchMock).not.toHaveBeenCalled()
      fireEvent.submit(search.closest('form')!)
      expect(await screen.findByText(/No packaged foods found/)).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
