import type { KeyboardEvent } from 'react'

/**
 * Enter in a number field commits it (the field blurs) without submitting;
 * here Enter saves, so a weigh-in is type + Enter.
 */
export function submitOnEnter(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement) || e.target.type !== 'text') return
  e.preventDefault()
  const form = e.currentTarget
  setTimeout(() => form.requestSubmit(), 0)
}

