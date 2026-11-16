/**
 * "Send feedback": a new GitHub issue from the feedback form
 * (`.github/ISSUE_TEMPLATE/feedback.yml`), with the app version and platform
 * filled in (issue forms read field values from the URL, by field id).
 * Nothing else about the user goes into the URL.
 */
import { BUILD_INFO, platformLabel } from './buildInfo'
import { RELEASES_REPO } from './updates'

export function feedbackUrl(details?: string): string {
  const params = new URLSearchParams({
    template: 'feedback.yml',
    version: `${BUILD_INFO.version} (${BUILD_INFO.commit})`,
    platform: platformLabel() === 'Android' ? 'Android app' : 'Website / home-screen app',
  })
  if (details) params.set('details', details.slice(0, 500))
  return `https://github.com/${RELEASES_REPO}/issues/new?${params.toString()}`
}
