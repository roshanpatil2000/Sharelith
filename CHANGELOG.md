# Changelog

Tester-facing notes for each build live in `release-notes/<version>.txt` and are sent with `npm run distribute:android`.

## 1.0.3 (build 10003)

- **Ads:** one banner pinned below the tab bar for every tab (was a footer on each list screen); it owns the bottom safe area once an ad loads.
- **Account:** shows the app version and build number.

## 1.0.2 (build 10002)

- **Ads (Android):** AdMob banner pinned below the tab bar; native ads in Activity every 10 items; an interstitial after a new expense (not in the first 3, at most every 5 minutes). Google's consent form first where required, non-personalised unless agreed; Account → About → Ad choices. Remote Config `ads_enabled`, `interstitial_min_minutes`, `interstitial_after_saves`.
- **Fixed:** launch crash when live updates re-subscribed before the old realtime channel closed.
- **Fixed:** release builds crashed on launch after adding AdMob (R8 removed WorkManager's database).

## 1.0.1 (build 10001)

- App icon and splash screen.
- Firebase Crashlytics, Performance and Remote Config (force update, feature switches).
- Android App Links for sign-up, reset and invite emails.
- Payment reminders and push notifications (Android).
- Side tab rail on wide screens; round tab buttons on the iPhone Duo.
- Privacy policy and Terms, with consent at sign-up.
