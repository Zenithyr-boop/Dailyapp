import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { db } from '../../../lib/db'
import { GoalsPage } from './GoalsPage'

const year = new Date().getFullYear()

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/me/goals', element: <GoalsPage /> },
      { path: '/me', element: <p>me page</p> },
    ],
    { initialEntries: ['/me/goals'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.profile.put({
    id: 'me',
    displayName: 'Sam',
    units: 'metric',
    rank: 'E',
    bestLevel: 1,
    onboarding: 'done',
    body: { sex: 'male', birthYear: year - 30, heightCm: 180, weightKg: 80, activity: 'moderate' },
    plan: { goal: 'lose', rateKgPerWeek: 0.5 },
    goals: { macroMode: 'auto', kcal: 2210, proteinG: 160, fatG: 64, carbsG: 249 },
    updatedAt: 0,
  })
})

describe('GoalsPage', () => {
  it('recalculates targets live and saves them', async () => {
    renderPage()
    expect(await screen.findByText('2,210')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '90' } })
    expect(screen.getByText('2,360')).toBeInTheDocument() // +100 kcal BMR × 1.55
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    const p = await db.profile.get('me')
    expect(p?.body?.weightKg).toBe(90)
    expect(p?.goals).toMatchObject({ macroMode: 'auto', kcal: 2360, proteinG: 180 })
  })

  it('"Set my own numbers" keeps the user’s numbers, with a note below the floor', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('radio', { name: 'Set my own numbers' }))
    const kcal = screen.getByLabelText('Calories (kcal)')
    expect(kcal).toHaveValue('2210')
    fireEvent.change(kcal, { target: { value: '1300' } })
    expect(screen.getByText(/below 1,500 kcal/)).toBeInTheDocument()
    expect(screen.getByText(/over your calorie target/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect((await db.profile.get('me'))?.goals).toMatchObject({ macroMode: 'custom', kcal: 1300, proteinG: 160 })
  })

  it('asks before leaving with unsaved changes', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Alex' } })
    fireEvent.click(screen.getByRole('link', { name: 'Me' }))
    expect(await screen.findByRole('dialog', { name: 'Save your goals?' })).toBeInTheDocument()
  })
})
