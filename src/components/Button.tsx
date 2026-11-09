import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

const VARIANTS = {
  primary: 'bg-accent text-on-accent hover:bg-text',
  secondary: 'border border-panel-edge text-text hover:border-accent hover:text-accent',
} as const

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-touch items-center justify-center gap-2 px-5 font-display text-base font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}
