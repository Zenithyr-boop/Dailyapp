import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from './AppLayout'
import { NotFoundPage } from './NotFoundPage'
import { QuestsPage } from '../features/quests/QuestsPage'
import { EditQuestsPage } from '../features/quests/EditQuestsPage'
import { TrainPage } from '../features/train/TrainPage'
import { FoodPage } from '../features/food/FoodPage'
import { SquadPage } from '../features/squad/SquadPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { BodyPage } from '../features/body/BodyPage'
import { ProgramsPage } from '../features/programs/ProgramsPage'
import { CommunityPage } from '../features/community/CommunityPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/quests" replace /> },
      { path: 'quests', element: <QuestsPage /> },
      { path: 'quests/edit', element: <EditQuestsPage /> },
      { path: 'train', element: <TrainPage /> },
      { path: 'food', element: <FoodPage /> },
      { path: 'squad', element: <SquadPage /> },
      { path: 'me', element: <ProfilePage /> },
      { path: 'body', element: <BodyPage /> },
      { path: 'programs', element: <ProgramsPage /> },
      { path: 'community', element: <CommunityPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
