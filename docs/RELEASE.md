# Releasing Sharelith

## Android app

One app, `com.sharelith.app` ("Sharelith").

- Run: `npm run android`.
- Build: `./gradlew :app:assembleRelease` (APK) or `:app:bundleRelease` (Play bundle).
- Firebase reads `android/app/google-services.json` (git-ignored); without it the app builds without Firebase.
- Debug builds always show Google's test ads; release builds show real ads.

## Version

`package.json` holds the one version for both apps.

1. Bump it, for example `1.0.0` → `1.0.1`.
2. Run `npm run version:sync` to copy it into the iOS project.

Android reads it directly.

### Build number

The build number is the **build time in epoch seconds** (Unix time), for example `1795196400`. Every build gets a higher number than the last, so several store uploads of the same version are fine. The app shows it on the Account screen as `Sharelith 1.0.4 (1795196400)`.

- **Android:** `android/app/build.gradle` sets `versionCode` when building.
- **iOS:** Xcode's "Set build number" build phase writes it into the built app's `CFBundleVersion` (the project file keeps a placeholder).
- **Repeat a build exactly:** set `BUILD_NUMBER`, e.g. `BUILD_NUMBER=1795196400 ./gradlew :app:bundleRelease`.
- `npm run distribute:android` prints the number it built.

**Limit:** Google Play's highest build number is 2,100,000,000, which epoch seconds reach on **18 July 2036**. Before then, move to a new scheme whose numbers are still higher than the last upload.

## Android: upload key (once)

Google Play signs the published app; you sign uploads with your own *upload key*. Keep the key and its passwords out of the repo, and back them up: losing them means asking Google to reset the upload key.

1. Create the key, outside the project. `keytool` asks for the passwords; choose your own.

   ```bash
   mkdir -p ~/keys && keytool -genkeypair -v -storetype PKCS12 -keystore ~/keys/sharelith-upload.keystore -alias sharelith-upload -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Tell Gradle where it is, in `~/.gradle/gradle.properties` (your home folder, not the project):

   ```properties
   SHARELITH_UPLOAD_STORE_FILE=/Users/<you>/keys/sharelith-upload.keystore
   SHARELITH_UPLOAD_STORE_PASSWORD=<store password>
   SHARELITH_UPLOAD_KEY_ALIAS=sharelith-upload
   SHARELITH_UPLOAD_KEY_PASSWORD=<key password>
   ```

Without these settings, release builds stop with an error instead of being signed with the debug key: Play rejects debug-signed builds, and Android App Links only verify for the upload key listed in the website's `/.well-known/assetlinks.json`. Debug builds are unaffected.

## Android: send to testers (Firebase App Distribution)

Once:

1. In the Firebase console, open **App Distribution**, accept the terms, and under **Testers & Groups** create a group called `testers` with your testers' emails.
2. Sign the CLI in to your Google account: `npx firebase-tools login`.

Then, for each build:

```bash
npm run distribute:android -- "What's new in this build"
```

It builds a signed release APK and uploads it; testers get an email with an install link. Without notes on the command line it sends `release-notes/<version>.txt`; write that file (and update `CHANGELOG.md`) before each release. Set `FIREBASE_TESTER_GROUPS` to send to other groups.

## Ads (AdMob)

Real AdMob IDs are set: the app ID in `app.json`, the ad unit IDs in `src/lib/env.ts`. Debug builds always show test ads. To change them:

1. In AdMob, add the Android app `com.sharelith.app` and create the ad units: Interstitial and Native advanced (the Banner unit is no longer used).
2. Put the app ID in `app.json` → `react-native-google-mobile-ads.android_app_id`, and the unit IDs in `.env` (`ADMOB_INTERSTITIAL_ID`, `ADMOB_NATIVE_ID`). Debug builds always show test ads.
3. In AdMob → Privacy & messaging, create the GDPR (UMP) consent message.
4. Publish `app-ads.txt` with your publisher ID on the website.

Ads are controlled from Firebase Remote Config; changes reach open apps within seconds (real-time updates), no new build needed:

| Key | Default | What it does |
|---|---|---|
| `pro_enabled` | true | Shows Sharelith Pro (banner and row) in Account; Pro members always see it |
| `insights_enabled` | true | Shows Insights in Account; Pro members always see it |
| `ads_enabled` | true | Master switch: off hides every ad |
| `interstitial_enabled` | true | Full-screen ad at natural breaks (moving between tabs, opening or leaving a group, friend or expense, saving a new expense) |
| `native_activity_enabled` | true | Native ad rows in Activity |
| `native_groups_enabled` | true | Native ad rows in Groups |
| `native_friends_enabled` | true | Native ad rows in Friends |
| `interstitial_min_minutes` | 3 | Minutes between full-screen ads |
| `interstitial_skip_first` | 3 | Breaks before the first full-screen ad |

## Android: build

```bash
cd android && ./gradlew :app:bundleRelease
```

The bundle to upload is `android/app/build/outputs/bundle/release/app-release.aab`. Use `assembleRelease` instead for an APK you can install directly.

Release builds run R8, which shrinks the code and can break libraries that rely on reflection. Always install a release build and check sign-in, adding an expense and the app lock before uploading.

## iOS: build

1. Open `ios/Sharelith.xcworkspace` in Xcode.
2. Under *Signing & Capabilities*, choose your Apple Developer team.
3. Choose *Product → Archive*, then *Distribute App → TestFlight*.

## Store listings need

- **Privacy policy URL:** `https://sharelith.techbeas.co.in/privacy`, deployed from the [Sharelith-deeplink](https://github.com/roshanpatil2000/Sharelith-deeplink) repo.
- **Data safety (Play) and App Privacy (App Store):** match the privacy policy (`privacy.html` in Sharelith-deeplink). The app collects name, email, optional phone, photo and financial records of what you split, with no tracking and no ads.
- **Account deletion:** in the app under Account → Delete account. Both stores require this.

## Still to do before a public release

- **Crash reporting:** needs a Sentry (or similar) account and its DSN.
- **Universal links / App Links:** replace the `sharelith://` auth callback. This needs the Apple Team ID, and the SHA-256 fingerprint of the Play app signing key for `assetlinks.json`.
