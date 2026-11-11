import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from './AppLayout'
import { NotFoundPage } from './NotFoundPage'
import { QuestsPage } from '../features/quests/QuestsPage'
import { EditQuestsPage } from '../features/quests/EditQuestsPage'
import { HistoryPage } from '../features/quests/HistoryPage'
import { TrainPage } from '../features/train/TrainPage'
import { MovementLibraryPage } from '../features/train/library/MovementLibraryPage'
import { MovementDetailPage } from '../features/train/library/MovementDetailPage'
import { MovementFormPage } from '../features/train/library/MovementFormPage'
import { WorkoutBuilderPage } from '../features/train/workouts/WorkoutBuilderPage'
import { SessionPage } from '../features/train/sessions/SessionPage'
import { SessionSummaryPage } from '../features/train/sessions/SessionSummaryPage'
import { FoodPage } from '../features/food/FoodPage'
import { AddFoodPage } from '../features/food/AddFoodPage'
import { CustomFoodFormPage } from '../features/food/CustomFoodFormPage'
import { MyFoodsPage } from '../features/food/MyFoodsPage'
import { SavedMealPage, SavedMealsPage } from '../features/food/SavedMealsPage'
import { SquadPage } from '../features/squad/SquadPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { GoalsPage } from '../features/profile/goals/GoalsPage'
import { OnboardingGate } from '../features/onboarding/OnboardingGate'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { BodyPage } from '../features/body/BodyPage'
import { ProgramsPage } from '../features/programs/ProgramsPage'
import { CommunityPage } from '../features/community/CommunityPage'

export const router = createBrowserRouter([
  // First-run flow: full screen, outside the app shell.
  { path: '/welcome', element: <OnboardingPage /> },
  {
    path: '/',
    element: (
      <OnboardingGate>
        <AppLayout />
      </OnboardingGate>
    ),
    children: [
      { index: true, element: <Navigate to="/quests" replace /> },
      { path: 'quests', element: <QuestsPage /> },
      { path: 'quests/edit', element: <EditQuestsPage /> },
      { path: 'quests/history', element: <HistoryPage /> },
      { path: 'train', element: <TrainPage /> },
      { path: 'train/movements', element: <MovementLibraryPage /> },
      { path: 'train/movements/new', element: <MovementFormPage /> },
      { path: 'train/movements/:id', element: <MovementDetailPage /> },
      { path: 'train/movements/:id/edit', element: <MovementFormPage /> },
      { path: 'train/workouts/new', element: <WorkoutBuilderPage /> },
      { path: 'train/workouts/:id', element: <WorkoutBuilderPage /> },
      { path: 'train/session', element: <SessionPage /> },
      { path: 'train/sessions/:id', element: <SessionSummaryPage /> },
      { path: 'food', element: <FoodPage /> },
      { path: 'food/add', element: <AddFoodPage /> },
      { path: 'food/foods', element: <MyFoodsPage /> },
      { path: 'food/foods/new', element: <CustomFoodFormPage /> },
      { path: 'food/foods/:id/edit', element: <CustomFoodFormPage /> },
      { path: 'food/meals', element: <SavedMealsPage /> },
      { path: 'food/meals/:id', element: <SavedMealPage /> },
      { path: 'squad', element: <SquadPage /> },
      { path: 'me', element: <ProfilePage /> },
      { path: 'me/goals', element: <GoalsPage /> },
      { path: 'body', element: <BodyPage /> },
      { path: 'programs', element: <ProgramsPage /> },
      { path: 'community', element: <CommunityPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
