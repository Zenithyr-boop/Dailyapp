import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

interface DialogProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Disable closing (Esc / Cancel) while something is running. */
  busy?: boolean
}

/** Flat modal "System window": focus moves in, Tab stays inside, Esc closes. */
export function Dialog({ title, onClose, children, busy = false }: DialogProps) {
  const titleId = useId()
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const first = boxRef.current?.querySelector<HTMLElement>('input, button, [href], select, textarea')
    first?.focus()
    return () => previous?.focus?.()
  }, [])

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !busy) {
      e.stopPropagation()
      onClose()
    }
    if (e.key !== 'Tab' || !boxRef.current) return
    const items = [...boxRef.current.querySelectorAll<HTMLElement>('input, button, [href], select, textarea')].filter(
      (el) => !el.hasAttribute('disabled'),
    )
    const first = items[0]
    const last = items.at(-1)
    if (!first || !last) return
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-bg/85 px-4 py-6">
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md border border-panel-edge bg-panel"
      >
        <h2 id={titleId} className="border-b border-line-soft px-5 py-3 text-xl">
          {title}
        </h2>
        <div className="space-y-4 px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
