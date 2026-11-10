import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { db } from '../../../lib/db'
import { TrainPage } from '../TrainPage'
import { WorkoutBuilderPage } from './WorkoutBuilderPage'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/train', element: <TrainPage /> },
      { path: '/train/workouts/new', element: <WorkoutBuilderPage /> },
      { path: '/train/workouts/:id', element: <WorkoutBuilderPage /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const cards = () => within(screen.getByRole('list', { name: 'Movements' })).getAllByRole('article')

describe('workout builder', { timeout: 20_000 }, () => {
  it('lists the starter templates on the Train tab with an estimated time', async () => {
    renderAt('/train')
    const starters = await screen.findByRole('region', { name: 'Starter templates' })
    const ppl = within(starters).getByRole('region', { name: 'Push / Pull / Legs' })
    expect(within(ppl).getAllByRole('link').map((a) => a.textContent)).toEqual([
      expect.stringMatching(/^Push.*5 movements · ≈ \d+ min/),
      expect.stringContaining('Pull'),
      expect.stringContaining('Legs'),
    ])
    expect(within(starters).getByRole('region', { name: 'Upper / Lower' })).toBeInTheDocument()
    expect(within(starters).getByRole('region', { name: 'Full Body, 3 days' })).toBeInTheDocument()
  })

  it('opens a starter with its movements, targets and supersets', async () => {
    renderAt('/train/workouts/starter-ppl-push')
    expect(await screen.findByRole('heading', { name: 'Push', level: 1 })).toBeInTheDocument()
    await vi.waitFor(() => expect(cards()[0]).toHaveAccessibleName('Barbell Bench Press - Medium Grip'), { timeout: 8000 })
    expect(cards()[3]).toHaveAccessibleName('A1 Side Lateral Raise')
    expect(cards()[4]).toHaveAccessibleName('A2 Triceps Pushdown - Rope Attachment')
    expect(within(cards()[3]!).getByText('None · straight to A2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('builds a new workout from the library picker and saves it', async () => {
    const router = renderAt('/train/workouts/new')
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Arm day' } })

    fireEvent.click(screen.getByRole('button', { name: 'Add movements' }))
    const picker = await screen.findByRole('dialog', { name: 'Add movements' })
    expect(router.state.location.search).toBe('?add=1')
    fireEvent.change(within(picker).getByRole('searchbox', { name: 'Search movements' }), { target: { value: 'plank' } })
    fireEvent.click(await within(picker).findByRole('checkbox', { name: /^Plank/ }, { timeout: 8000 }))
    fireEvent.change(within(picker).getByRole('searchbox', { name: 'Search movements' }), { target: { value: 'barbell curl' } })
    // Coach's picks rank first.
    fireEvent.click((await within(picker).findAllByRole('checkbox', { name: /^Barbell Curl/ }))[0]!)
    fireEvent.click(within(picker).getByRole('button', { name: 'Add 2 movements' }))

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual(['Plank', 'Barbell Curl'])
    // Plank is timed, so it gets seconds instead of a rep range.
    expect(within(cards()[0]!).getByLabelText('Seconds')).toHaveValue('30')
    expect(within(cards()[1]!).getByLabelText('Minimum reps for Barbell Curl')).toHaveValue('8')

    // Reorder with the buttons, add a set, superset them.
    fireEvent.click(screen.getByRole('button', { name: 'Move Barbell Curl up' }))
    expect(cards()[0]).toHaveAccessibleName('Barbell Curl')
    fireEvent.click(within(cards()[0]!).getByRole('button', { name: 'More sets for barbell curl' }))
    fireEvent.click(screen.getByRole('button', { name: 'Superset Barbell Curl with Plank' }))
    expect(cards()[0]).toHaveAccessibleName('A1 Barbell Curl')

    fireEvent.click(screen.getAllByRole('button', { name: 'Save workout' })[0]!)
    await vi.waitFor(() => expect(router.state.location.pathname).toMatch(/^\/train\/workouts\/[0-9a-f-]{36}$/))
    const saved = (await db.workouts.toArray())[0]!
    expect(saved).toMatchObject({ name: 'Arm day' })
    expect(saved.items).toEqual([
      expect.objectContaining({ movementId: 'Barbell_Curl', sets: 4, repsMin: 8, repsMax: 12, group: expect.any(String) }),
      expect.objectContaining({ movementId: 'Plank', sets: 3, seconds: 30, group: saved.items[0]!.group }),
    ])
  })

  it('asks before leaving with unsaved changes', async () => {
    const router = renderAt('/train/workouts/starter-fb-a')
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Full Body A+' } })
    fireEvent.click(screen.getByRole('link', { name: 'Train' }))
    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(router.state.location.pathname).toBe('/train/workouts/starter-fb-a')
    expect(await db.workouts.count()).toBe(0) // starters aren't stored until saved
  })

  it('deletes a workout', async () => {
    const router = renderAt('/train/workouts/starter-ul-upper')
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete workout?' })).getByRole('button', { name: 'Delete' }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/train'))
    expect((await db.workouts.get('starter-ul-upper'))?.deleted).toBe(1)
  })
})
