import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { OfflineBanner } from './OfflineBanner'
import { RouteError } from './RouteError'

function Boom({ error }: { error: Error }): never {
  throw error
}

function renderCrash(error: Error, inShell = false) {
  const router = createMemoryRouter([{ path: '/', element: <Boom error={error} />, errorElement: <RouteError inShell={inShell} /> }])
  return render(<RouterProvider router={router} />)
}

describe('RouteError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a friendly message with Reload, and keeps the details out of the way', () => {
    renderCrash(new Error('db exploded'))
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByText(/Your data is safe/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Quests' })).toHaveAttribute('href', '/quests')
    expect(screen.getByText('Error: db exploded')).not.toBeVisible()
    expect(screen.getByRole('link', { name: 'send feedback' }).getAttribute('href')).toContain('details=Error')
  })

  it('explains a stale file after a deploy', () => {
    renderCrash(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'), true)
    expect(screen.getByRole('heading', { name: 'FromZero was updated' })).toBeInTheDocument()
  })
})

describe('OfflineBanner', () => {
  it('shows while offline and hides when back online', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    render(<OfflineBanner />)
    expect(screen.getByText(/still saves on this device/)).toBeInTheDocument()
    online.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(/still saves on this device/)).not.toBeInTheDocument()
    online.mockRestore()
  })
})
