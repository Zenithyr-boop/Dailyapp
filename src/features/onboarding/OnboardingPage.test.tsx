import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { db } from '../../lib/db'
import { listQuestDefs } from '../quests/questsRepo'
import { OnboardingGate } from './OnboardingGate'
import { OnboardingPage } from './OnboardingPage'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/welcome', element: <OnboardingPage /> },
      {
        path: '/',
        element: (
          <OnboardingGate>
            <p>the app</p>
          </OnboardingGate>
        ),
      },
      { path: '/quests', element: <p>quests page</p> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Skip)$/ }))

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('OnboardingGate', () => {
  it('sends a new user to the welcome flow', async () => {
    renderAt('/')
    expect(await screen.findByLabelText('What should we call you?')).toBeInTheDocument()
  })

  it('lets a user who finished (or skipped) it straight in', async () => {
    await db.profile.put({ id: 'me', displayName: '', units: 'metric', rank: 'E', bestLevel: 1, goals: {}, onboarding: 'skipped', updatedAt: 0 })
    renderAt('/')
    expect(await screen.findByText('the app')).toBeInTheDocument()
  })
})

describe('OnboardingPage', () => {
  it('walks through every question, calculates targets and saves the picked quests', async () => {
    const year = new Date().getFullYear()
    const router = renderAt('/welcome')

    fireEvent.change(await screen.findByLabelText('What should we call you?'), { target: { value: 'Sam' } })
    next()
    expect(screen.getByRole('radio', { name: 'kg' })).toBeChecked()
    next()
    fireEvent.click(screen.getByRole('radio', { name: 'Male' }))
    next()
    fireEvent.change(screen.getByLabelText('What year were you born?'), { target: { value: String(year - 30) } })
    next()
    fireEvent.change(screen.getByLabelText('How tall are you?'), { target: { value: '180' } })
    next()
    fireEvent.change(screen.getByLabelText('What do you weigh now?'), { target: { value: '80' } })
    next()
    fireEvent.click(screen.getByRole('radio', { name: /^Active/ }))
    next()
    fireEvent.click(screen.getByRole('radio', { name: /^Lose fat/ }))
    next()

    // Fastest rate: gentle note. 1 kg is over 1% of 80 kg, so it's capped at 0.8.
    fireEvent.click(screen.getByRole('radio', { name: /^1 kg \/ week/ }))
    expect(screen.getByText(/This is the fastest option/)).toBeInTheDocument()
    next()

    expect(screen.getByRole('heading', { name: 'Your daily targets' })).toBeInTheDocument()
    expect(screen.getByText('1,880')).toBeInTheDocument() // 2,759 maintenance − 0.8 kg × 7,700 / 7
    expect(screen.getByText(/capped at 0.8 kg a week/)).toBeInTheDocument()
    next()

    fireEvent.click(screen.getByRole('checkbox', { name: /Read 10 pages/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /No alcohol/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/quests'))
    const profile = await db.profile.get('me')
    expect(profile).toMatchObject({
      displayName: 'Sam',
      onboarding: 'done',
      body: { sex: 'male', birthYear: year - 30, heightCm: 180, weightKg: 80, activity: 'moderate' },
      plan: { goal: 'lose', rateKgPerWeek: 1 },
      goals: { macroMode: 'auto', kcal: 1880, proteinG: 160 },
    })
    const titles = (await listQuestDefs()).map((q) => q.title)
    expect(titles).toContain('No alcohol')
    expect(titles).not.toContain('Read 10 pages')
    expect(titles).toHaveLength(6)
  })

  it('skips the rate question for maintain, and every question can be skipped', async () => {
    renderAt('/welcome')
    await screen.findByLabelText('What should we call you?')
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
    for (let i = 0; i < 8; i++) next() // name … goal (maintain is pre-selected)
    expect(screen.getByRole('heading', { name: 'Your daily targets' })).toBeInTheDocument()
    expect(screen.getByText(/Add your birth year, height, weight and activity/)).toBeInTheDocument()
  })

  it('"Skip setup" keeps the default quests and leaves the profile untouched', async () => {
    const router = renderAt('/welcome')
    await screen.findByLabelText('What should we call you?')
    fireEvent.click(screen.getByRole('button', { name: 'Skip setup' }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/quests'))
    const profile = await db.profile.get('me')
    expect(profile?.onboarding).toBe('skipped')
    expect(profile?.body).toBeUndefined()
    expect(profile?.plan).toBeUndefined()
    expect(profile?.goals).toEqual({})
    expect(await listQuestDefs()).toHaveLength(6)
  })
})
