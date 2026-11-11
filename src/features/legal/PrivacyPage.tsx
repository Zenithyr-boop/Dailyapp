import { Link } from 'react-router'
import { ChevronLeftIcon } from '../../components/icons'
import { Panel } from '../../components/Panel'
import { CONTACT_URL, POLICY_INTRO, POLICY_SECTIONS, POLICY_UPDATED } from './privacyPolicy'

/**
 * `/privacy`: full screen, outside the app shell and the onboarding gate, so anyone
 * (and Health Connect's "Privacy policy" link) can read it before setting anything up.
 */
export function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <Link
        to="/me"
        className="-ml-2 mb-3 inline-flex min-h-touch items-center gap-1 px-2 font-display font-bold uppercase tracking-wider text-muted hover:text-accent"
      >
        <ChevronLeftIcon size={18} />
        FromZero
      </Link>
      <header className="mb-5">
        <h1 className="text-4xl font-extrabold leading-none">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated {POLICY_UPDATED}</p>
      </header>
      <p className="mb-4 text-muted">{POLICY_INTRO}</p>
      <div className="space-y-4">
        {POLICY_SECTIONS.map((s) => (
          <Panel key={s.heading} title={s.heading}>
            <div className="space-y-2 text-muted">
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.bullets && (
                <ul className="list-disc space-y-1 pl-5">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        ))}
      </div>
      <p className="mt-4 text-muted">
        Contact:{' '}
        <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2 hover:text-text">
          FromZero on GitHub
        </a>
      </p>
    </main>
  )
}
