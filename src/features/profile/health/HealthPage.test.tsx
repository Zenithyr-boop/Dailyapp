import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { HealthPage } from './HealthPage'

const m = vi.hoisted(() => ({
  support: 'available' as 'available' | 'unavailable' | 'unsupported',
  state: { connected: false, metrics: [] as string[], granted: [] as string[], imported: {} },
  connectHealth: vi.fn(async (metrics: string[]) => metrics),
}))

vi.mock('../../../lib/health/bridge', () => ({
  HEALTH_METRIC_LABEL: { steps: 'Steps', sleep: 'Sleep', weight: 'Weight' },
  healthSupport: async () => m.support,
  openHealthConnectSettings: vi.fn(async () => {}),
}))
vi.mock('../../today/healthSync', () => ({
  useHealthState: () => m.state,
  connectHealth: m.connectHealth,
  disconnectHealth: vi.fn(async () => {}),
  syncHealth: vi.fn(async () => 0),
}))

const renderPage = () =>
  render(
    <MemoryRouter>
      <HealthPage />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  m.support = 'available'
  m.state = { connected: false, metrics: [], granted: [], imported: {} }
})

describe('Health Connect screen', () => {
  it('explains what is read before asking, with steps and sleep on and weight opt-in', async () => {
    renderPage()
    expect(await screen.findByText('What happens to it')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Read the privacy policy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('checkbox', { name: /Steps/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Sleep/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Weight/ })).not.toBeChecked()

    fireEvent.click(screen.getByRole('checkbox', { name: /Weight/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Health Connect' }))
    expect(m.connectHealth).toHaveBeenCalledWith(['steps', 'sleep', 'weight'])
  })

  it('can’t continue with nothing chosen', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('checkbox', { name: /Steps/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Sleep/ }))
    expect(screen.getByRole('button', { name: 'Continue to Health Connect' })).toBeDisabled()
  })

  it('shows what is being read once connected, and says when something wasn’t allowed', async () => {
    m.state = { connected: true, metrics: ['steps', 'weight'], granted: ['steps'], imported: {} }
    renderPage()
    expect(await screen.findByText('Steps')).toBeInTheDocument()
    expect(screen.getByText(/Not allowed in Health Connect: Weight/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
  })

  it('points the website to the Android app', async () => {
    m.support = 'unsupported'
    renderPage()
    expect(await screen.findByRole('link', { name: 'Get the Android app' })).toHaveAttribute(
      'href',
      'https://github.com/Zenithyr-boop/Dailyapp/releases/latest',
    )
  })
})
