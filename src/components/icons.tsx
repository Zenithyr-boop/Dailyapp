import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

/** Base for all icons: 24px grid, 1.8px stroke, currentColor, square caps. */
function Icon({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function QuestsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4" width="5" height="5" />
      <path d="M4.8 6.6l1.2 1.2 2-2.4" />
      <path d="M12 6.5h8.5" />
      <rect x="3.5" y="14.5" width="5" height="5" />
      <path d="M12 17h8.5" />
    </Icon>
  )
}

export function TrainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 12h8" />
      <rect x="4.5" y="7" width="3.5" height="10" />
      <rect x="16" y="7" width="3.5" height="10" />
      <path d="M2 10v4M22 10v4" />
    </Icon>
  )
}

export function FoodIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v6" />
      <path d="M17 21V3c-2 1.5-3 4-3 7v3h3" />
    </Icon>
  )
}

export function SquadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20" />
      <path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M18 14.2a4.5 4.5 0 0 1 3 4.3V20" />
    </Icon>
  )
}

export function MeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 21v-1.5A5.5 5.5 0 0 1 10 14h4a5.5 5.5 0 0 1 5.5 5.5V21" />
    </Icon>
  )
}

export function BodyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15" />
      <path d="M8 9.5a6 6 0 0 1 8 0l-2.5 3.5h-3z" />
      <path d="M12 13l1.2-2" />
    </Icon>
  )
}

export function ProgramsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M8 14.5l2.5 2.5 5-5" />
    </Icon>
  )
}

export function CommunityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4.5h16v11H9.5L5 19.5v-4H4z" />
      <path d="M8 9h8M8 12h5" />
    </Icon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 6l6 6-6 6" />
    </Icon>
  )
}
