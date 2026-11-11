import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { db } from '../../lib/db'
import { QuestsPage } from './QuestsPage'

function renderPage(url = '/quests') {
  const router = createMemoryRouter([{ path: '/quests', element: <QuestsPage /> }], { initialEntries: [url] })
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
      rank: 'E',
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

  describe('days', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-10T14:18:00'))
    })
    afterEach(() => vi.useRealTimers())

    const oldDay = (date: string) =>
      db.days.put({ date, quests: [{ id: 'q1', title: 'Read', xp: 30, kind: 'check', done: true }], updatedAt: 0 })

    it('shows the countdown to the reset', async () => {
      renderPage()
      expect(await screen.findByText('resets in 9h 42m')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
    })

    it('keeps yesterday open (grace day)', async () => {
      await oldDay('2026-11-09')
      renderPage('/quests?date=2026-11-09')
      const box = await screen.findByRole('checkbox', { name: /Read/ })
      expect(box).toBeEnabled()
      expect(screen.getByText('open for 9h 42m')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Edit quests' })).not.toBeInTheDocument()
    })

    it('locks older days', async () => {
      await oldDay('2026-11-08')
      renderPage('/quests?date=2026-11-08')
      const box = await screen.findByRole('checkbox', { name: /Read/ })
      expect(box).toBeDisabled()
      expect(box).toBeChecked()
      expect(screen.getByText(/This day is closed/)).toBeInTheDocument()
    })

    it('never shows a future day', async () => {
      renderPage('/quests?date=2026-11-11')
      expect(await screen.findByRole('button', { name: 'Showing today' })).toBeInTheDocument()
    })

    it('moves back a day with the switcher', async () => {
      await oldDay('2026-11-09')
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: 'Previous day' }))
      expect(await screen.findByRole('button', { name: /Showing Yesterday/ })).toBeInTheDocument()
      expect(await screen.findByRole('checkbox', { name: /Read/ })).toBeChecked()
    })

    it('picks a day from the calendar', async () => {
      await oldDay('2026-11-03')
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: 'Pick a day' }))
      const dialog = await screen.findByRole('dialog', { name: 'Pick a day' })
      expect(within(dialog).getByRole('button', { name: /November 11/ })).toBeDisabled()
      fireEvent.click(within(dialog).getByRole('button', { name: /November 3.*1 of 1 quests done/ }))
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(await screen.findByRole('checkbox', { name: /Read/ })).toBeDisabled()
    })
  })
})
