/**
 * Draws the FromZero "FZ" mark (Midnight: flat, square, accent strokes on bg) into
 * the source images `@capacitor/assets` turns into every Android icon and splash size,
 * and into the PWA icon.
 *
 *   npm run icons    (this script, then `capacitor-assets generate --android`)
 *
 * Change the mark here, never in the generated files.
 */
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const BG = '#0B0E14'
const PANEL = '#121722'
const ACCENT = '#4DA3FF'

/** The two letters, drawn in a 1024 box (they fill roughly the middle 42%). */
const LETTERS =
  `<g fill="none" stroke="${ACCENT}" stroke-width="64" stroke-linecap="square" stroke-linejoin="miter">` +
  '<path d="M300 692V332H468M300 508H436"/><path d="M556 332H724L556 692H724"/></g>'

/** Panel with the 1px-style "System window" edge, around the letters. */
const FRAME = `<rect x="112" y="112" width="800" height="800" fill="${PANEL}" stroke="${ACCENT}" stroke-width="24"/>`

function svg(size: number, body: string, background = true): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    (background ? `<rect width="${size}" height="${size}" fill="${BG}"/>` : '') +
    body +
    '</svg>'
  )
}

/** The 1024 mark scaled into a canvas of `size`, centred. */
function centred(size: number, scale: number, body: string): string {
  return `<g transform="translate(${size / 2} ${size / 2}) scale(${scale}) translate(-512 -512)">${body}</g>`
}

async function png(name: string, source: string): Promise<void> {
  await sharp(Buffer.from(source)).png().toFile(`assets/${name}`)
  console.log(`assets/${name}`)
}

const mark = svg(1024, FRAME + LETTERS)

// PWA / favicon.
writeFileSync('public/icon.svg', mark.replace(/ width="1024" height="1024"/, '') + '\n')
console.log('public/icon.svg')

// Legacy (pre-Android 8) launcher icon: the whole framed mark.
await png('icon-only.png', mark)
// Adaptive icon: launchers mask it to a circle or squircle, so the frame is left out and the
// letters stay inside the 66% safe zone of the foreground layer.
await png('icon-background.png', svg(1024, ''))
await png('icon-foreground.png', svg(1024, LETTERS, false))
// Splash: the framed mark, small, on bg (the same for light and dark: the app is always dark).
const splash = svg(2732, centred(2732, 0.5, FRAME + LETTERS))
await png('splash.png', splash)
await png('splash-dark.png', splash)
