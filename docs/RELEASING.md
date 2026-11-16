# Releasing FromZero

Bump the version on **every user-facing change**. `package.json` → `version` is the only place the
version lives:

- the website shows it on Me ("FromZero 0.9.0 · a1b2c3d · 11 Nov · Web") and writes it to `/version.json`;
- the APK's `versionName` is read from it, and `versionCode` is worked out from it
  (`android/app/build.gradle`: 1.2.3 → 10203), so it always goes up.

Versions are `MAJOR.MINOR.PATCH`, each part 0–99 (so the versionCode stays in order).
Bug fixes bump PATCH (0.9.0 → 0.9.1), new features bump MINOR (0.9.1 → 0.10.0).

## 1. Bump the version

In `package.json` (and the two matching lines at the top of `package-lock.json`):

```json
"version": "0.9.0",
```

Commit it with the change, on the feature branch.

## 2. Push → the website deploys itself

Open a pull request (GitHub Actions posts a preview link), then merge it into `main`.
The merge deploys the live site. Within a minute of the deploy:

- open website tabs and home-screen apps see **"New version available · Update"** the next time
  they open or come back into view (they fetch `/version.json`, uncached, and ask the service
  worker to check). Update switches to the new files and reloads.
- Me → **Check for updates** does the same on demand. **Force refresh** is the fallback when
  something looks stuck: it removes the service worker and the cached app files and reloads
  (logged data and the sign-in stay).

Nothing else is needed for the website. The Android app is NOT updated by a deploy: it carries its
own copy of the web code. Only a new APK updates it.

## 3. Build the signed APK

Claude can run these (needs Android Studio installed; it bundles Java):

```bash
npm run android:sync
```

```bash
cd android && JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`, signed with the release keystore
(`android/keystore.properties`, git-ignored). Rename it to `FromZero-0.9.0.apk` (the version from
`package.json`).

The same in Android Studio: run `npm run android:sync` first, then **Build → Generate Signed App
Bundle or APK… → APK → Next →** choose the keystore (`C:\Users\kevin\FromZero-keys\fromzero-release`)
and enter its passwords **→ Next → release → Create**. Android Studio shows "locate" when it's done:
the APK is in `android/app/release/`.

Always sign with the same release keystore. An APK signed with another key can't install over the
old one, and users would have to uninstall (losing on-device data such as progress photos).

## 4. Publish the GitHub Release

The tag must be `v` + the package.json version (`v0.9.0`), or the app's update check won't match.

```bash
gh release create v0.9.0 FromZero-0.9.0.apk --title "FromZero 0.9.0" --notes "What changed, in a line or two."
```

Or on github.com: the repo → **Releases → Draft a new release → Choose a tag →** type `v0.9.0` →
**Create new tag → Target: main →** title `FromZero 0.9.0` → drag `FromZero-0.9.0.apk` into the
binaries box → **Publish release**.

Within 6 hours (or right away with Me → Check for updates), the Android app shows
**"Update available · Download"**. Download opens the APK in the phone's browser; installing it
over the old one keeps the data. The repository must stay public for the check and the download.

## Checklist

- [ ] `version` bumped in package.json (+ package-lock.json)
- [ ] `npm run lint`, `npm run test`, `npm run build` pass
- [ ] PR merged → live site shows the new version on Me
- [ ] APK built from the merged `main`, signed with the release keystore
- [ ] Release `v<version>` published with `FromZero-<version>.apk` attached
