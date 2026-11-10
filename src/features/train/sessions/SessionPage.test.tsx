import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { db, getMeta, type Session } from '../../../lib/db'
import { QuestsPage } from '../../quests/QuestsPage'
import { TrainPage } from '../TrainPage'
import { starterById } from '../workouts/starters'
import { SessionPage } from './SessionPage'
import { SessionSummaryPage } from './SessionSummaryPage'
import { getActiveSession, startSession, targetFromItem } from './sessionsRepo'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/quests', element: <QuestsPage /> },
      { path: '/train', element: <TrainPage /> },
      { path: '/train/session', element: <SessionPage /> },
      { path: '/train/sessions/:id', element: <SessionSummaryPage /> },
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

const card = (name: string) => screen.getByRole('article', { name })

/** A finished Full Body A from two days ago: squats 100 × 8, 8, 8 at RPE 8. */
async function seedLastSession() {
  const fb = starterById('starter-fb-a')!
  const squat = fb.items[0]!
  const startedAt = Date.now() - 2 * 86_400_000
  const s: Session = {
    id: 'past',
    date: '2026-11-08',
    name: 'Full Body A',
    templateId: fb.id,
    startedAt,
    finishedAt: startedAt + 3_000_000,
    exercises: [
      {
        key: 'sq',
        movementId: squat.movementId,
        target: targetFromItem(squat),
        sets: [1, 2, 3].map((n) => ({ key: `s${n}`, done: true, kg: 100, reps: 8, rpe: 8 })),
      },
    ],
    updatedAt: startedAt,
  }
  await db.sessions.put(s)
}

describe('live session logging', { timeout: 25_000 }, () => {
  it('starts from a workout, logs a set, runs the rest timer and finishes', async () => {
    const router = renderAt('/train')
    const fullBody = await screen.findByRole('region', { name: 'Full Body, 3 days' })
    fireEvent.click(within(fullBody).getByRole('button', { name: 'Start Full Body A' }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/train/session'), { timeout: 8000 })
    await vi.waitFor(() => expect(card('Barbell Squat')).toBeInTheDocument(), { timeout: 8000 })
    expect(within(card('Barbell Squat')).getByText('First time logging this movement.')).toBeInTheDocument()

    const squat = card('Barbell Squat')
    const kg = within(squat).getByRole('textbox', { name: 'kg, set 1, Barbell Squat' })
    fireEvent.change(kg, { target: { value: '100' } })
    fireEvent.blur(kg)
    const reps = within(squat).getByRole('textbox', { name: 'Reps, set 1, Barbell Squat' })
    fireEvent.change(reps, { target: { value: '5' } })
    fireEvent.blur(reps)
    fireEvent.click(within(squat).getByRole('button', { name: 'Set 1 done, Barbell Squat' }))

    // Saved straight away…
    await vi.waitFor(async () =>
      expect((await getActiveSession())!.exercises[0]!.sets[0]).toMatchObject({ kg: 100, reps: 5, done: true }),
    )
    // …and the rest timer runs with the squat's 3 min rest.
    const timer = await screen.findByRole('region', { name: 'Rest timer' })
    expect(within(timer).getByRole('timer')).toHaveTextContent(/^(3:00|2:59)$/)
    expect((await getMeta<{ total: number }>('restTimer'))?.total).toBe(180)
    fireEvent.click(within(timer).getByRole('button', { name: '15 seconds more rest' }))
    await vi.waitFor(async () => expect((await getMeta<{ total: number }>('restTimer'))?.total).toBe(195))
    fireEvent.click(within(timer).getByRole('button', { name: 'Skip' }))
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Rest timer' })).not.toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('button', { name: 'Finish' })[0]!)
    const dialog = await screen.findByRole('dialog', { name: 'Finish session?' })
    expect(dialog).toHaveTextContent('1 of 12 sets done')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finish' }))

    await vi.waitFor(() => expect(router.state.location.pathname).toMatch(/^\/train\/sessions\//), { timeout: 8000 })
    expect(await screen.findByText('Session complete')).toBeInTheDocument()
    expect(screen.getByText(/Train quest done/)).toBeInTheDocument()
    const sets = screen.getByRole('region', { name: 'Sets' })
    expect(within(sets).getByText('100×5')).toBeInTheDocument()
    const today = (await db.days.toArray()).at(-1)!
    expect(today.quests.find((q) => q.title === 'Train')?.done).toBe(true)
  })

  it('prefills weights from last time and offers the progression step', async () => {
    await seedLastSession()
    renderAt('/train')
    const fullBody = await screen.findByRole('region', { name: 'Full Body, 3 days' })
    fireEvent.click(within(fullBody).getByRole('button', { name: 'Start Full Body A' }))
    await vi.waitFor(() => expect(card('Barbell Squat')).toBeInTheDocument(), { timeout: 8000 })

    const squat = card('Barbell Squat')
    expect(within(squat).getByText('Last time: 100×8 · 100×8 · 100×8')).toBeInTheDocument()
    expect(within(squat).getByRole('textbox', { name: 'kg, set 1, Barbell Squat' })).toHaveValue('100')
    // Every set hit 8 reps at RPE 8 → +2.5 kg for a lower-body lift.
    fireEvent.click(within(squat).getByRole('button', { name: 'Try 102.5 kg (+2.5)' }))
    await vi.waitFor(() => expect(within(card('Barbell Squat')).getByRole('textbox', { name: 'kg, set 3, Barbell Squat' })).toHaveValue('102.5'))
  })

  it('shows a resume banner on the Quests screen while a session is open', async () => {
    await startSession(undefined, () => 'weight_reps')
    const router = renderAt('/quests')
    const banner = await screen.findByRole('link', { name: /Resume session/ }, { timeout: 5000 })
    expect(banner).toHaveTextContent('Workout')
    fireEvent.click(banner)
    expect(router.state.location.pathname).toBe('/train/session')
  })
})
