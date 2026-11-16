/**
 * FromZero's privacy policy: the one copy of the text. It's shown in the app at
 * `/privacy` (PrivacyPage) and built into `privacypolicy.html` (policyHtml.ts, a
 * Vite plugin in vite.config.ts), a script-free page that Health Connect opens from
 * its permission screen (the Android rationale WebView runs no JavaScript) and that
 * the website serves at /privacypolicy.html.
 *
 * Keep it true: update it whenever the app starts collecting or sending anything new.
 */

export const POLICY_UPDATED = '16 November 2026'

/** Where people can ask questions about the app and their data. */
export const CONTACT_EMAIL = 'fromzero1245@gmail.com'

export interface PolicySection {
  heading: string
  paragraphs: string[]
  /** Optional bullet list after the paragraphs. */
  bullets?: string[]
}

export const POLICY_INTRO =
  'FromZero is a free fitness and discipline tracker made by a personal trainer. This page explains, in plain words, ' +
  'what the app stores, where it goes and what it never does. It covers the website, the installable web app and the ' +
  'Android app.'

export const POLICY_SECTIONS: PolicySection[] = [
  {
    heading: 'The short version',
    paragraphs: [],
    bullets: [
      'Everything you log stays on your device unless you sign in.',
      'If you sign in, your data is copied to your own account so it syncs between your devices. Only you can read it.',
      'Progress photos never leave the device they were taken on. They are never uploaded.',
      'No ads, no analytics, no tracking. Your data is never sold, rented or shared.',
      'Health Connect data is only read, only for your daily stats and quests, and never shared with anyone.',
      'You can download all of your data, and delete it, at any time from the Me screen.',
    ],
  },
  {
    heading: 'What is stored on your device',
    paragraphs: [
      'Your quests, workouts, food log, body weight and measurements, steps, sleep, water, programs and settings are ' +
        'stored in the app’s own storage on your device. The app works fully without an account.',
      'Progress photos are stored only on the device they were taken on. They are never uploaded, never synced and ' +
        'not included in exports.',
    ],
  },
  {
    heading: 'Your account and sync (optional)',
    paragraphs: [
      'If you sign in with Google or with an email and password, FromZero uses Google Firebase (Firebase Authentication ' +
        'and Cloud Firestore) to copy your data to your account and keep your devices in step. Security rules make sure ' +
        'only you can read or change your data. Nobody else, including other FromZero users, can see it.',
      'Firebase receives your email address, your name if you sign in with Google, and the data you log in the app ' +
        '(not your progress photos). Your cloud copy is kept until you delete your account.',
    ],
  },
  {
    heading: 'Health Connect (Android app)',
    paragraphs: [
      'If you choose to connect Health Connect, FromZero reads only the data types you allow: steps, sleep sessions ' +
        'and body weight. It never writes to Health Connect and never reads any other health data.',
      'The data is used only to fill in your daily steps, sleep and weigh-ins in FromZero and to tick the quests ' +
        'linked to them. It is stored on your day records like a value you type in, so if you are signed in it syncs ' +
        'to your own account and shows on your other devices.',
      'FromZero never sells Health Connect data, never shares it with third parties, never uses it for advertising, ' +
        'and never uses it to decide on credit, insurance or employment. The use of information received from Health ' +
        'Connect adheres to the Health Connect Permissions policy, including the Limited Use requirements.',
      'You can disconnect in Me → Health Connect, and remove FromZero’s access at any time in Android Settings → ' +
        'Health Connect → App permissions.',
    ],
  },
  {
    heading: 'Camera',
    paragraphs: [
      'The camera is used only to scan food barcodes, when you open the scanner. Images are processed on your device ' +
        'and are never stored or sent anywhere. Progress photos you take or choose are kept on your device only.',
    ],
  },
  {
    heading: 'Other services the app talks to',
    paragraphs: [],
    bullets: [
      'Open Food Facts: when you scan a barcode or search for a packaged food, the barcode number or your search words ' +
        'are sent to look up the product. Nothing that identifies you is sent.',
      'GitHub: exercise photos load from GitHub when you open a movement; the Download page and the Android app check ' +
        'GitHub Releases for the newest version, and the Android app downloads from there. No FromZero data is sent.',
      'Send feedback (Me → About) opens a new issue on GitHub. Issues are public and show your GitHub name, so don’t ' +
        'put anything private in them; email us instead.',
      'Google Fonts and Firebase Hosting serve the website’s fonts and files, like any website.',
    ],
  },
  {
    heading: 'Download your data',
    paragraphs: [
      'Me → Your data → Export JSON saves everything you’ve logged in one file, which Import JSON can read back on ' +
        'any device. Export CSV saves your days, quests, food log and workout sets as spreadsheet files. Neither ' +
        'includes progress photos.',
    ],
  },
  {
    heading: 'Deleting your data',
    paragraphs: [],
    bullets: [
      'Signed in: Me → Account → Delete my account, then type DELETE. Your account and its cloud copy are deleted ' +
        'straight away. You can also choose to remove the data from the device you’re using.',
      'Not signed in: Me → Your data → Erase everything on this device, then type ERASE.',
      'Uninstalling the Android app, or clearing this website’s data in your browser, also removes everything stored ' +
        'on that device, including progress photos.',
      `Can’t get into your account? Email ${CONTACT_EMAIL} from the address you signed up with and we’ll delete it ` +
        'for you.',
    ],
  },
  {
    heading: 'Children',
    paragraphs: ['FromZero is not directed at children under 13.'],
  },
  {
    heading: 'Changes and contact',
    paragraphs: [
      'If this policy changes, the new version is published here with a new date. Questions about your data or ' +
        `this policy: email ${CONTACT_EMAIL}.`,
    ],
  },
]
