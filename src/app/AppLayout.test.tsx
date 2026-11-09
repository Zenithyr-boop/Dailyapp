import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppLayout } from './AppLayout'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <p>quests page</p> },
          { path: 'food', element: <p>food page</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

describe('AppLayout', () => {
  it('shows all five tabs in the mobile tab bar', () => {
    renderAt('/')
    const [tabBar] = screen.getAllByRole('navigation', { name: 'Main' }).filter((n) => n.tagName === 'NAV' && n.className.includes('bottom-0'))
    for (const label of ['Quests', 'Train', 'Food', 'Squad', 'Me']) {
      expect(within(tabBar!).getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('marks the current route as active', () => {
    renderAt('/food')
    expect(screen.getByText('food page')).toBeInTheDocument()
    const activeLinks = screen.getAllByRole('link', { name: 'Food' })
    activeLinks.forEach((link) => expect(link).toHaveAttribute('aria-current', 'page'))
    screen.getAllByRole('link', { name: 'Quests' }).forEach((link) => expect(link).not.toHaveAttribute('aria-current'))
  })
})
