import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { db } from '../../lib/db'
import { addDays, dayKeyAt } from '../../lib/day'
import { ensureSetup } from '../quests/questsRepo'
import { BodyPage } from './BodyPage'
import { saveBody, saveWeight } from './bodyRepo'
import { MeasurementsPage } from './MeasurementsPage'
import { addPhoto, deletePhoto } from './photos/photosRepo'
import { PhotosPage } from './photos/PhotosPage'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/body', element: <BodyPage /> },
      { path: '/body/measurements', element: <MeasurementsPage /> },
      { path: '/body/photos', element: <PhotosPage /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureSetup()
})

describe('Body screen', { timeout: 15_000 }, () => {
  it('logs today’s weigh-in', async () => {
    renderAt('/body')
    const panel = await screen.findByRole('region', { name: 'Today’s weigh-in' })
    fireEvent.change(within(panel).getByLabelText('Weight'), { target: { value: '82.4' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved 82.4 kg for today.')).toBeInTheDocument()
    expect((await db.days.get(dayKeyAt()))?.weightKg).toBe(82.4)
    expect(await within(screen.getByRole('region', { name: 'Weigh-ins' })).findByRole('button', { name: /Today: 82\.4 kg/ })).toBeInTheDocument()
  })

  it('shows the trend, weekly rate and goal estimate in pounds', async () => {
    await db.profile.update('me', { units: 'imperial', goalWeightKg: 75 })
    const today = dayKeyAt()
    for (let i = 0; i < 14; i++) await saveWeight(addDays(today, -i), 80 - (13 - i) * 0.1) // −0.7 kg a week
    renderAt('/body')
    const trend = await screen.findByRole('region', { name: 'Weight trend' })
    expect(within(trend).getByText('Per week').nextElementSibling).toHaveTextContent('−1.5lb')
    expect(within(trend).getByText(/^Around .* at this rate\.$/)).toBeInTheDocument()
  })

  it('edits and removes a past weigh-in from the list', async () => {
    const yesterday = addDays(dayKeyAt(), -1)
    await saveWeight(yesterday, 81)
    renderAt('/body')
    fireEvent.click(await screen.findByRole('button', { name: /Yesterday: 81\.0 kg/ }))
    const dialog = await screen.findByRole('dialog', { name: /Weigh-in · Yesterday/ })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove weigh-in' }))
    expect(await screen.findByText('Nothing logged yet.')).toBeInTheDocument()
    expect((await db.days.get(yesterday))?.weightKg).toBeUndefined()
  })
})

describe('Measurements screen', { timeout: 15_000 }, () => {
  it('logs measurements for a day and shows their history', async () => {
    await saveBody(addDays(dayKeyAt(), -14), { waistCm: 90 })
    renderAt('/body/measurements')
    fireEvent.change(await screen.findByLabelText('Waist'), { target: { value: '88.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved for today.')).toBeInTheDocument()
    expect((await db.days.get(dayKeyAt()))?.measurements).toEqual({ waistCm: 88.5 })
    const history = screen.getByRole('region', { name: 'History' })
    expect(await within(history).findByRole('button', { name: /Today: 88\.5 cm/ })).toBeInTheDocument()
    expect(within(history).getByText('−1.5 cm')).toBeInTheDocument()
  })
})

describe('Photos screen', { timeout: 15_000 }, () => {
  const bytes = () => new Uint8Array([1, 2, 3]).buffer
  // The test DOM has no object URLs.
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
  })

  it('says photos stay on the device and lists them by day', async () => {
    renderAt('/body/photos')
    expect(await screen.findByText(/never uploaded, not even when you’re signed in/)).toBeInTheDocument()
    expect(screen.getByText(/They don’t sync between your devices yet/)).toBeInTheDocument()
    expect(await screen.findByText('No photos yet.')).toBeInTheDocument()
    const id = await addPhoto({ image: bytes(), thumb: bytes(), type: 'image/jpeg', width: 3, height: 4 }, dayKeyAt(), 'front')
    expect(await screen.findByRole('button', { name: 'Front photo, Today. Open' })).toBeInTheDocument()
    expect(await db.photoImages.get(id)).toBeDefined()
    await deletePhoto(id)
    expect(await screen.findByText('No photos yet.')).toBeInTheDocument()
    expect(await db.photoImages.get(id)).toBeUndefined()
  })
})
