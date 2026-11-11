import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { db } from '../../lib/db'
import { dayKeyAt } from '../../lib/day'
import { ensureDay, ensureSetup } from '../quests/questsRepo'
import { BadgesPanel } from './BadgesPanel'
import { ProgramBuilderPage } from './ProgramBuilderPage'
import { ProgramsPage } from './ProgramsPage'

function renderAt(url: string) {
  const router = createMemoryRouter(
    [
      { path: '/programs', element: <ProgramsPage /> },
      { path: '/programs/new/:template', element: <ProgramBuilderPage /> },
      { path: '/me', element: <BadgesPanel /> },
    ],
    { initialEntries: [url] },
  )
  render(<RouterProvider router={router} />)
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureSetup()
  await ensureDay()
})

describe('Programs', () => {
  it('offers the three programs and never says "75 Hard"', async () => {
    renderAt('/programs')
    expect(await screen.findByRole('heading', { name: '66-day reset' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '75-day challenge' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Custom program' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/75 hard/i)
  })

  it('starts the 75-day challenge (strict by default) and shows day 1 on a 75-square grid', async () => {
    renderAt('/programs/new/75-day-challenge')
    expect(await screen.findByRole('checkbox', { name: /Strict mode/ })).toBeChecked()
    expect(screen.getByText('Drink 3.8 L water')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start 75-day challenge' }))

    expect(await screen.findByText('Day 1')).toBeInTheDocument()
    const grid = screen.getByRole('list', { name: 'Program days' })
    expect(within(grid).getAllByRole('listitem')).toHaveLength(75)
    expect(screen.getByText('Strict · a miss restarts')).toBeInTheDocument()
    const today = await db.days.get(dayKeyAt())
    expect(today!.quests.filter((q) => q.programId)).toHaveLength(6)
  })

  it('66-day reset: picks the user’s own habits and ideas', async () => {
    renderAt('/programs/new/66-day-reset')
    const start = await screen.findByRole('button', { name: 'Start 66-day reset' })
    expect(start).toBeDisabled()
    fireEvent.click(await screen.findByRole('checkbox', { name: /Read 10 pages/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Meditate 10 minutes/ }))
    fireEvent.click(start)
    expect(await screen.findByText('A miss is marked, not a restart')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Program days' })).getAllByRole('listitem')).toHaveLength(66)
    const program = (await db.programs.toArray())[0]!
    expect(program).toMatchObject({ kind: '66-day-reset', length: 66, strict: false })
    expect(program.rules.map((r) => r.title)).toEqual(['Read 10 pages', 'Meditate 10 minutes'])
  })

  it('shows finished programs as badges on Me', async () => {
    renderAt('/me')
    expect(await screen.findByText('Finish a program to earn its badge.')).toBeInTheDocument()
    await db.programs.put({
      id: 'p1',
      kind: '66-day-reset',
      name: '66-day reset',
      length: 66,
      strict: false,
      rules: [],
      startDate: '2026-09-01',
      attempts: [],
      status: 'finished',
      questIds: [],
      adopted: [],
      endDate: '2026-11-05',
      daysDone: 60,
      bonusXp: 1320,
      updatedAt: 1,
    })
    expect(await screen.findByText('+1,320 XP')).toBeInTheDocument()
    expect(screen.getByText(/60\/66 days/)).toBeInTheDocument()
  })
})
