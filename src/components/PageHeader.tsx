import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  /** Small line above the title, e.g. today's date. */
  kicker?: string
  aside?: ReactNode
}

export function PageHeader({ title, kicker, aside }: PageHeaderProps) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <div>
        {kicker && <p className="label mb-1">{kicker}</p>}
        <h1 className="text-4xl font-extrabold leading-none">{title}</h1>
      </div>
      {aside}
    </header>
  )
}
