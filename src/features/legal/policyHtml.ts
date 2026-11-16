/**
 * The privacy policy as a standalone, script-free HTML page in the Midnight colours.
 * Built into `privacypolicy.html` by vite.config.ts: Health Connect's permission
 * rationale screen (a WebView with JavaScript off) shows it from the APK's assets,
 * and the website serves it at /privacypolicy.html.
 */
import { CONTACT_EMAIL, POLICY_INTRO, POLICY_SECTIONS, POLICY_UPDATED } from './privacyPolicy.ts'

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function privacyPolicyHtml(): string {
  const sections = POLICY_SECTIONS.map(
    (s) =>
      `<section><h2>${escape(s.heading)}</h2>` +
      s.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('') +
      (s.bullets ? `<ul>${s.bullets.map((b) => `<li>${escape(b)}</li>`).join('')}</ul>` : '') +
      '</section>',
  ).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0B0E14" />
<title>Privacy policy · FromZero</title>
<style>
  body { margin: 0; background: #0B0E14; color: #E6EBF5; font: 16px/1.55 system-ui, sans-serif; }
  main { max-width: 42rem; margin: 0 auto; padding: 24px 16px 48px; }
  h1, h2 { font-family: "Barlow Condensed", system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.04em; }
  h1 { font-size: 2rem; margin: 0 0 4px; }
  h2 { font-size: 1.1rem; color: #4DA3FF; margin: 0 0 8px; }
  section { border: 1px solid #1F3554; background: #121722; padding: 16px; margin-top: 16px; }
  p, li { color: #93A0B8; margin: 0 0 8px; }
  ul { margin: 0; padding-left: 20px; }
  a { color: #4DA3FF; }
  .updated { color: #93A0B8; font-size: 0.875rem; margin: 0 0 16px; }
</style>
</head>
<body>
<main>
<h1>Privacy policy</h1>
<p class="updated">FromZero · last updated ${escape(POLICY_UPDATED)}</p>
<p>${escape(POLICY_INTRO)}</p>
${sections}
<p style="margin-top:16px">Contact: <a href="mailto:${CONTACT_EMAIL}">${escape(CONTACT_EMAIL)}</a></p>
</main>
</body>
</html>
`
}
