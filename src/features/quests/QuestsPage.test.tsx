import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { db } from '../../lib/db'
import { QuestsPage } from './QuestsPage'

function renderPage() {
  const router = createMemoryRouter([{ path: '/quests', element: <QuestsPage /> }], { initialEntries: ['/quests'] })
  render(<RouterProvider router={router} />)
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('QuestsPage', () => {
  it('shows the default quests, level and streak for a new user', async () => {
    renderPage()
    expect(await screen.findByRole('checkbox', { name: /Train/ })).not.toBeChecked()
    expect(screen.getAllByRole('checkbox')).toHaveLength(6)
    expect(screen.getByText('Level 1')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Rank E' })).toBeInTheDocument()
    expect(screen.getByText('0/6')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit quests' })).toHaveAttribute('href', '/quests/edit')
  })

  it('checks a quest off and counts it', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('checkbox', { name: /Read 10 pages/ }))
    expect(await screen.findByText('1/6')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Read 10 pages/ })).toBeChecked()
  })

  it('shows the level-up moment and lets the user dismiss it', async () => {
    await db.profile.put({
      id: 'me',
      displayName: '',
      units: 'metric',
      totalXp: 0,
      level: 1,
      rank: 'E',
      streak: 0,
      bestLevel: 1,
      goals: {},
      updatedAt: 0,
    })
    // An old day worth enough XP for level 2 triggers the moment on load.
    await db.days.put({ date: '2026-01-01', quests: [{ id: 'x', title: 'X', xp: 900, kind: 'check', done: true }], updatedAt: 0 })
    renderPage()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Level 2' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
