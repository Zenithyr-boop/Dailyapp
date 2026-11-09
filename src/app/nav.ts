import type { ComponentType, SVGProps } from 'react'
import {
  BodyIcon,
  CommunityIcon,
  FoodIcon,
  MeIcon,
  ProgramsIcon,
  QuestsIcon,
  SquadIcon,
  TrainIcon,
} from '../components/icons'

export interface NavItem {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
}

/** Main destinations: bottom tab bar on mobile, top of the side nav on desktop. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Quests', Icon: QuestsIcon },
  { to: '/train', label: 'Train', Icon: TrainIcon },
  { to: '/food', label: 'Food', Icon: FoodIcon },
  { to: '/squad', label: 'Squad', Icon: SquadIcon },
  { to: '/me', label: 'Me', Icon: MeIcon },
]

/** Secondary screens: side nav on desktop, linked from the Me page on mobile. */
export const SECONDARY_NAV: NavItem[] = [
  { to: '/body', label: 'Body', Icon: BodyIcon },
  { to: '/programs', label: 'Programs', Icon: ProgramsIcon },
  { to: '/community', label: 'Community', Icon: CommunityIcon },
]
