import { useState, type ReactNode } from 'react'
import { MinusIcon, PlusIcon } from '../../../components/icons'

export const inputClass =
  'block min-h-touch w-full min-w-0 border border-line bg-bg px-3 text-text placeholder:text-faint focus:border-accent focus:outline-none'

/** Square 44px icon button with an accessible name. */
export function IconButton({
  label,
  disabled,
  onClick,
  children,
  className = '',
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-touch shrink-0 place-items-center text-muted hover:text-accent disabled:opacity-30 disabled:hover:text-muted ${className}`}
    >
      {children}
    </button>
  )
}

/**
 * Number input that lets the user type freely (empty, "1" on the way to "12")
 * and clamps on blur. Reports `undefined` when cleared if `optional`.
 * `live` (default) reports valid values while typing; otherwise only on blur
 * or Enter (for values written straight to the database).
 */
export function NumberField({
  id,
  value,
  onChange,
  min,
  max,
  optional = false,
  precision = 0,
  live = true,
  placeholder,
  className = '',
  ...aria
}: {
  id?: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  min: number
  max: number
  optional?: boolean
  /** Decimals allowed (0 = whole numbers). */
  precision?: number
  live?: boolean
  placeholder?: string
  className?: string
  'aria-label'?: string
}) {
  const factor = 10 ** precision
  const round = (n: number) => Math.round(n * factor) / factor
  const [text, setText] = useState(value === undefined ? '' : String(value))
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    // The value changed from outside (or was clamped): show it.
    setShown(value)
    setText(value === undefined ? '' : String(value))
  }

  function commit(raw: string) {
    if (raw.trim() === '') {
      if (optional) onChange(undefined)
      else setText(value === undefined ? '' : String(value))
      return
    }
    const n = round(Number(raw.replace(',', '.')))
    if (!Number.isFinite(n)) return setText(value === undefined ? '' : String(value))
    const clamped = Math.min(max, Math.max(min, n))
    setText(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode={precision ? 'decimal' : 'numeric'}
      autoComplete="off"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        if (!live) return
        const n = Number(e.target.value.replace(',', '.'))
        if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) {
          setShown(round(n))
          onChange(round(n))
        }
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={`${inputClass} px-2 text-center font-display text-lg font-semibold tabular-nums ${className}`}
      {...aria}
    />
  )
}

/** − value + with 44px buttons. */
export function Stepper({
  label,
  value,
  display,
  onChange,
  min,
  max,
  step = 1,
}: {
  /** Accessible name, e.g. "Sets for Bench Press". */
  label: string
  value: number
  display?: string
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
}) {
  return (
    <div role="group" aria-label={label} className="flex border border-line bg-bg">
      <button
        type="button"
        aria-label={`Less ${label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="grid size-touch shrink-0 place-items-center text-muted hover:text-accent disabled:opacity-30"
      >
        <MinusIcon size={16} />
      </button>
      <output aria-live="polite" className="grid min-w-0 flex-1 place-items-center font-display text-lg font-semibold tabular-nums">
        {display ?? value}
      </output>
      <button
        type="button"
        aria-label={`More ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="grid size-touch shrink-0 place-items-center text-muted hover:text-accent disabled:opacity-30"
      >
        <PlusIcon size={16} />
      </button>
    </div>
  )
}
