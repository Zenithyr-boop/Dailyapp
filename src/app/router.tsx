import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate, type LazyRouteFunction, type RouteObject } from 'react-router'
import { AppLayout } from './AppLayout'
import { RouteError } from './RouteError'
import { QuestsPage } from '../features/quests/QuestsPage'
import { OnboardingGate } from '../features/onboarding/OnboardingGate'
// Eager too: a first visit lands here, and it's small.
import { OnboardingPage } from '../features/onboarding/OnboardingPage'

/**
 * Every screen except Quests (the one most opens land on) loads on demand, in its own
 * chunk, so the first screen only downloads what it needs. The service worker precaches
 * every chunk, so the app still works offline; the APK carries them all.
 * A chunk that's gone after a deploy shows "FromZero was updated · Reload" (RouteError).
 */
function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string): LazyRouteFunction<RouteObject> {
  return async () => ({ Component: (await load())[name] as ComponentType })
}

export const router = createBrowserRouter([
  // First-run flow: full screen, outside the app shell.
  { path: '/welcome', element: <OnboardingPage />, errorElement: <RouteError /> },
  // Readable by anyone, before setup too (Health Connect links here).
  { path: '/privacy', lazy: page(() => import('../features/legal/PrivacyPage'), 'PrivacyPage'), errorElement: <RouteError /> },
  // Shareable with people who don't have the app yet.
  { path: '/download', lazy: page(() => import('../features/download/DownloadPage'), 'DownloadPage'), errorElement: <RouteError /> },
  {
    path: '/',
    element: (
      <OnboardingGate>
        <AppLayout />
      </OnboardingGate>
    ),
    errorElement: <RouteError />,
    children: [
      {
        // A crashing page shows the error inside the shell, so the tabs still work.
        errorElement: <RouteError inShell />,
        children: [
          { index: true, element: <Navigate to="/quests" replace /> },
          // Wide: the desktop dashboard (quests + panels) uses more of the screen.
          { path: 'quests', element: <QuestsPage />, handle: { wide: true } },
          { path: 'quests/edit', lazy: page(() => import('../features/quests/EditQuestsPage'), 'EditQuestsPage') },
          { path: 'quests/history', lazy: page(() => import('../features/quests/HistoryPage'), 'HistoryPage') },
          { path: 'train', lazy: page(() => import('../features/train/TrainPage'), 'TrainPage') },
          { path: 'train/movements', lazy: page(() => import('../features/train/library/MovementLibraryPage'), 'MovementLibraryPage') },
          { path: 'train/movements/new', lazy: page(() => import('../features/train/library/MovementFormPage'), 'MovementFormPage') },
          { path: 'train/movements/:id', lazy: page(() => import('../features/train/library/MovementDetailPage'), 'MovementDetailPage') },
          { path: 'train/movements/:id/edit', lazy: page(() => import('../features/train/library/MovementFormPage'), 'MovementFormPage') },
          { path: 'train/workouts/new', lazy: page(() => import('../features/train/workouts/WorkoutBuilderPage'), 'WorkoutBuilderPage') },
          { path: 'train/workouts/:id', lazy: page(() => import('../features/train/workouts/WorkoutBuilderPage'), 'WorkoutBuilderPage') },
          { path: 'train/session', lazy: page(() => import('../features/train/sessions/SessionPage'), 'SessionPage') },
          { path: 'train/sessions/:id', lazy: page(() => import('../features/train/sessions/SessionSummaryPage'), 'SessionSummaryPage') },
          { path: 'food', lazy: page(() => import('../features/food/FoodPage'), 'FoodPage') },
          { path: 'food/add', lazy: page(() => import('../features/food/AddFoodPage'), 'AddFoodPage') },
          { path: 'food/foods', lazy: page(() => import('../features/food/MyFoodsPage'), 'MyFoodsPage') },
          { path: 'food/foods/new', lazy: page(() => import('../features/food/CustomFoodFormPage'), 'CustomFoodFormPage') },
          { path: 'food/foods/:id/edit', lazy: page(() => import('../features/food/CustomFoodFormPage'), 'CustomFoodFormPage') },
          { path: 'food/meals', lazy: page(() => import('../features/food/SavedMealsPage'), 'SavedMealsPage') },
          { path: 'food/meals/:id', lazy: page(() => import('../features/food/SavedMealsPage'), 'SavedMealPage') },
          { path: 'squad', lazy: page(() => import('../features/squad/SquadPage'), 'SquadPage') },
          { path: 'me', lazy: page(() => import('../features/profile/ProfilePage'), 'ProfilePage') },
          { path: 'me/goals', lazy: page(() => import('../features/profile/goals/GoalsPage'), 'GoalsPage') },
          { path: 'me/health', lazy: page(() => import('../features/profile/health/HealthPage'), 'HealthPage') },
          { path: 'body', lazy: page(() => import('../features/body/BodyPage'), 'BodyPage') },
          { path: 'body/measurements', lazy: page(() => import('../features/body/MeasurementsPage'), 'MeasurementsPage') },
          { path: 'body/photos', lazy: page(() => import('../features/body/photos/PhotosPage'), 'PhotosPage') },
          { path: 'body/photos/compare', lazy: page(() => import('../features/body/photos/ComparePage'), 'ComparePage') },
          { path: 'programs', lazy: page(() => import('../features/programs/ProgramsPage'), 'ProgramsPage') },
          { path: 'programs/new/:template', lazy: page(() => import('../features/programs/ProgramBuilderPage'), 'ProgramBuilderPage') },
          { path: 'community', lazy: page(() => import('../features/community/CommunityPage'), 'CommunityPage') },
          { path: '*', lazy: page(() => import('./NotFoundPage'), 'NotFoundPage') },
        ],
      },
    ],
  },
])
