import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { db } from '../../../lib/db'
import { MovementDetailPage } from './MovementDetailPage'
import { MovementFormPage } from './MovementFormPage'
import { MovementLibraryPage } from './MovementLibraryPage'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/train/movements', element: <MovementLibraryPage /> },
      { path: '/train/movements/new', element: <MovementFormPage /> },
      { path: '/train/movements/:id', element: <MovementDetailPage /> },
      { path: '/train/movements/:id/edit', element: <MovementFormPage /> },
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

describe('movement library', { timeout: 15_000 }, () => {
  it("shows coach's picks first, then everything else", async () => {
    renderAt('/train/movements')
    const picks = await screen.findByRole('region', { name: "Coach's picks" }, { timeout: 5000 })
    expect(within(picks).getAllByRole('link')[0]).toHaveTextContent('Barbell Squat')
    expect(screen.getByRole('region', { name: 'All movements A–Z' })).toBeInTheDocument()
  })

  it('searches with typos and filters by chip', async () => {
    const router = renderAt('/train/movements')
    const search = await screen.findByRole('searchbox', { name: 'Search movements' })
    fireEvent.change(search, { target: { value: 'dedlift' } })
    const results = await screen.findByRole('region', { name: 'Results' })
    expect(within(results).getAllByRole('link')[0]).toHaveTextContent('Barbell Deadlift')

    fireEvent.click(screen.getByRole('button', { name: 'Equipment' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dumbbell' }))
    await vi.waitFor(() =>
      expect(within(screen.getByRole('region', { name: 'Results' })).getAllByRole('link')[0]).toHaveTextContent(
        'Stiff-Legged Dumbbell Deadlift',
      ),
    )
    expect(router.state.location.search).toContain('equipment=dumbbell')
  })

  it('opens a movement with photos, instructions and an empty history', async () => {
    renderAt('/train/movements/Plank')
    expect(await screen.findByRole('heading', { name: 'Plank', level: 1 }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Plank: start position' })).toHaveAttribute(
      'src',
      expect.stringContaining('/exercises/Plank/0.jpg'),
    )
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'How to do it' })).toBeInTheDocument()
    expect(await screen.findByText(/Nothing logged yet/)).toBeInTheDocument()
  })

  it('creates a custom movement that then shows in the library', async () => {
    const router = renderAt('/train/movements/new?name=Landmine%20press')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Landmine press')
    fireEvent.click(within(screen.getByRole('group', { name: 'Main muscles' })).getByRole('button', { name: 'Shoulders' }))
    fireEvent.click(screen.getByRole('radio', { name: /Weight × reps/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('heading', { name: 'Landmine press', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/train\/movements\/custom-/)
    const stored = await db.movements.toArray()
    expect(stored[0]).toMatchObject({ name: 'Landmine press', primaryMuscles: ['shoulders'], dirty: 1 })

    await router.navigate('/train/movements')
    const mine = await screen.findByRole('region', { name: 'Your movements' }, { timeout: 5000 })
    expect(within(mine).getByRole('link')).toHaveTextContent('Landmine press')
  })
})
