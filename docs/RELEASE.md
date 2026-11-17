# Releasing Sharelith

## Version

`package.json` holds the one version for both apps.

1. Bump it, for example `1.0.0` → `1.0.1`.
2. Run `npm run version:sync` to copy it into the iOS project.

Android reads it directly. Both apps get build number `major*10000 + minor*100 + patch`, so 1.0.1 is build 10001. Store builds must have a higher number than the last one uploaded, so every store upload needs a new version.

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

Without these settings, release builds are signed with the debug key and print a warning. That's fine for testing on a phone, but Play rejects it.

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
