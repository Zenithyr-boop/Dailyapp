import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeftIcon } from '../../components/icons'
import { Panel } from '../../components/Panel'
import { Skeleton } from '../../components/Skeleton'
import { isAndroidApp } from '../../lib/platform'
import { SITE_URL } from '../../lib/site'
import { fetchLatestRelease, RELEASES_PAGE, type LatestRelease } from '../../lib/updates'

type Device = 'android' | 'ios' | 'desktop'

function detectDevice(): Device {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  // iPadOS reports itself as a Mac with touch.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  return 'desktop'
}

const linkClass = 'text-accent underline underline-offset-2 hover:text-text'

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-5 text-muted marker:font-display marker:font-bold marker:text-accent">{children}</ol>
}

/**
 * `/download`: the Android APK (latest GitHub Release) and how to put the web app
 * on a home screen. Outside the app shell and the onboarding gate, so it can be
 * shared as a link with people who don't have the app yet.
 */
export function DownloadPage() {
  const [release, setRelease] = useState<LatestRelease | null | 'loading' | 'error'>('loading')
  const device = detectDevice()

  useEffect(() => {
    document.title = 'Download · FromZero'
    let live = true
    fetchLatestRelease()
      .then((r) => live && setRelease(r))
      .catch(() => live && setRelease('error'))
    return () => {
      live = false
      document.title = 'FromZero'
    }
  }, [])

  const android = (
    <Panel key="android" title="Android" aside="APK">
      <div className="space-y-4">
        <p className="text-muted">
          The Android app is the full FromZero, plus steps and sleep from Health Connect. It isn’t on the Play Store:
          you install it straight from our releases.
        </p>
        {isAndroidApp() ? (
          <p className="border-l-2 border-accent pl-3 text-text">You’re using the Android app. It tells you when a new version is out.</p>
        ) : release === 'loading' ? (
          <div role="status" aria-label="Looking up the latest version" className="space-y-2">
            <Skeleton className="h-11 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : release && typeof release === 'object' ? (
          <div className="space-y-1">
            <a
              href={release.downloadUrl}
              className="inline-flex min-h-touch items-center justify-center bg-accent px-5 font-display text-base font-bold uppercase tracking-wider text-on-accent hover:bg-text"
            >
              Download FromZero {release.version}
            </a>
            <p className="text-sm text-muted">
              {[
                release.apkSize ? formatSize(release.apkSize) : null,
                release.publishedAt
                  ? `released ${new Date(release.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : null,
                'Android 8 or newer',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        ) : (
          <p className="text-muted">
            {release === 'error' ? 'Couldn’t reach GitHub just now. ' : ''}
            Get the latest APK from the{' '}
            <a href={RELEASES_PAGE} className={linkClass}>
              releases page
            </a>
            .
          </p>
        )}
        <Steps>
          <li>Tap Download. Your browser may warn that the file can be harmful: choose Download anyway.</li>
          <li>Open the downloaded file. If Android asks, allow your browser to install unknown apps.</li>
          <li>Tap Install, then Open. Updates install the same way, over the old version, and keep your data.</li>
        </Steps>
      </div>
    </Panel>
  )

  const ios = (
    <Panel key="ios" title="iPhone and iPad" aside="Home screen">
      <div className="space-y-4">
        <p className="text-muted">
          On iPhone, FromZero runs as a web app from your home screen: full screen, works offline, no App Store needed.
        </p>
        <Steps>
          <li>
            Open{' '}
            <a href={SITE_URL} className={linkClass}>
              {SITE_URL.replace('https://', '')}
            </a>{' '}
            in Safari.
          </li>
          <li>Tap the Share button (the square with an arrow pointing up).</li>
          <li>Scroll down and tap Add to Home Screen, then Add.</li>
          <li>Open FromZero from the new icon on your home screen.</li>
        </Steps>
        <p className="text-sm text-muted">
          Steps and sleep from Apple Health aren’t available on iPhone yet: type them in on the Quests screen.
        </p>
      </div>
    </Panel>
  )

  const desktop = (
    <Panel key="desktop" title="Computer" aside="Optional">
      <div className="space-y-4">
        <p className="text-muted">FromZero works in any modern browser. To give it its own window:</p>
        <Steps>
          <li>Chrome or Edge: open the site, then click the install icon at the right of the address bar → Install.</li>
          <li>Safari on Mac: File → Add to Dock.</li>
        </Steps>
      </div>
    </Panel>
  )

  const order = device === 'ios' ? [ios, android, desktop] : [android, ios, desktop]

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <Link
        to="/quests"
        className="-ml-2 mb-3 inline-flex min-h-touch items-center gap-1 px-2 font-display font-bold uppercase tracking-wider text-muted hover:text-accent"
      >
        <ChevronLeftIcon size={18} />
        FromZero
      </Link>
      <header className="mb-5">
        <h1 className="text-4xl font-extrabold leading-none">Get FromZero</h1>
        <p className="mt-2 text-muted">Free. No ads. Works without an account.</p>
      </header>
      <div className="space-y-4">{order}</div>
      <p className="mt-4 text-muted">
        <Link to="/privacy" className={linkClass}>
          Privacy policy
        </Link>
      </p>
    </main>
  )
}
