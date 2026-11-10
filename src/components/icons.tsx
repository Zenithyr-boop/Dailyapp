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

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  )
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Icon>
  )
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Icon>
  )
}

export function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13 7l4 4" />
    </Icon>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </Icon>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 6l-6 6 6 6" />
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

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}

/** Drag handle: two columns of three dots, drawn as short strokes. */
export function GripIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth={3} />
    </Icon>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 8h12v12H8z" />
      <path d="M16 8V4H4v12h4" />
    </Icon>
  )
}

/** Superset link: two chain links. */
export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 14l4-4" />
      <path d="M8.5 11.5L6 14a3 3 0 004 4l2.5-2.5M15.5 12.5L18 10a3 3 0 00-4-4l-2.5 2.5" />
    </Icon>
  )
}

export function UnlinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 11.5L6 14a3 3 0 004 4l2.5-2.5M15.5 12.5L18 10a3 3 0 00-4-4l-2.5 2.5" />
      <path d="M4 4l3 3M20 20l-3-3" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 5v14l12-7z" />
    </Icon>
  )
}

/** Swap a movement: two opposing arrows. */
export function SwapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />
    </Icon>
  )
}

export function HistoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 108-8 8 8 0 00-6.5 3.3" />
      <path d="M4 4v4h4M12 8v4l3 2" />
    </Icon>
  )
}

/** Barcode: vertical bars of different widths. */
export function BarcodeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6v12M7 6v12M10.5 6v12M14 6v12M17 6v12M20 6v12" />
      <path d="M8.5 6v12M15.5 6v12" strokeWidth={0.9} />
    </Icon>
  )
}

/** Favourite: a star, filled when `filled`. */
export function StarIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Icon {...props} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
    </Icon>
  )
}

/** More actions: three dots. */
export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} />
    </Icon>
  )
}

/** Quick add: a lightning bolt. */
export function BoltIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
    </Icon>
  )
}
