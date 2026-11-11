import { useLocation, useNavigate, useSearchParams } from 'react-router'

/**
 * Dialogs that live in the URL (`?food=…`, `?scan=1`), so the phone's Back
 * button closes them. Opening pushes a history entry; closing goes back when
 * we pushed it, else just drops the parameter.
 */
export function useOverlay() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const pushed = !!(location.state as { overlay?: boolean } | null)?.overlay

  function with_(changes: Record<string, string | undefined>): string {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined) p.delete(k)
      else p.set(k, v)
    }
    const s = p.toString()
    return s ? `?${s}` : ''
  }

  return {
    params,
    open(key: string, value = '1') {
      navigate({ search: with_({ [key]: value }) }, { state: { overlay: true }, preventScrollReset: true })
    },
    /** Swap one dialog for another without adding a history entry (scan → found food). */
    swap(from: string, key: string, value = '1') {
      navigate({ search: with_({ [from]: undefined, [key]: value }) }, { replace: true, state: location.state, preventScrollReset: true })
    },
    close(...keys: string[]) {
      if (pushed) navigate(-1)
      else setParams(new URLSearchParams(with_(Object.fromEntries(keys.map((k) => [k, undefined])))), { replace: true, preventScrollReset: true })
    },
  }
}
