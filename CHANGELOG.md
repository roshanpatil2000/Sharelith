# Changelog

Tester-facing notes for each build live in `release-notes/<version>.txt` and are sent with `npm run distribute:android`.

## Unreleased

- Ads show more often: Activity after 5 items then every 6, Groups and Friends after 2 then every 5, full-screen ads up to every 2 minutes. Spacing can be tuned from Remote Config.

- **Screens and motion:** Get started after the welcome pages; full-screen Create group and Add expense forms (who paid and how it's split read as a sentence); illustrated empty states; large tab titles; Appearance screen; a Pro banner on Account; an explanation before the contacts permission. Side screens fade, drilling in slides, Add expense grows from its button. The tab bar is unchanged.
- **Welcome:** three swipeable pages after each log in or sign up (not when reopening signed in), with Skip. Permission prompts and ads wait until they're done.

## 1.0.8

- **Navigation:** floating bottom bar with a notch that slides to the selected tab (icons only). The side rail and foldable strip are unchanged.
- **Pro (server only):** manual Pro is now `pro_grants` (reason, dates, history) with `grant_pro` / `revoke_pro`, and `admin_pro_status` shows who has Pro and why. Replaces `profiles.pro_override`.
- **Fixed (server only):** granted Pro no longer shows an expired subscription's renewal date.
- **Android:** screenshots and screen recording work; `FLAG_SECURE` is removed, so the recent-apps preview also shows the app.

## 1.0.7

- **Comments:** push notifications and Activity entries for new comments (`comment_added`, `activities.note`, trigger on `expense_comments`; `send-push` shows the preview).
- **Performance:** Firebase Performance no longer collects on emulators.

## 1.0.6

- **Expenses:** date and notes in the form; comments (`expense_comments`, live); recurring expenses (`recurring_expenses`, daily pg_cron job); Recently deleted with restore (`list_deleted_expenses`).
- **Friends:** add from contacts (`react-native-contacts`, nothing uploaded but the person picked); invite links and QR codes (`invite_links`, `/invite/<token>` on the website, App Links on Android).
- **Search:** friends, groups and expenses by description, notes, group name or comments (`search_expenses`).
- **Groups:** totals and who paid, with Pro charts (`group_spending`, `group_member_spending`); default split per group (`groups.default_split`).
- **Splits:** itemized split (items, who had them, tax or tip in proportion), saved as exact amounts.
- **Currency:** converted amounts on Add expense; Pro total across currencies (ECB rates via Frankfurter).
- **Fixed:** Android keyboard covered inputs near the bottom (edge-to-edge); "not involved" for an expense that was all yours.

## 1.0.5

Build numbers are now the build time in epoch seconds (see docs/RELEASE.md), so this heading no longer lists one.

- **Pro:** status on the server (`subscriptions`, `pro_override`, `is_pro`), Pro screen with Google Play Billing (`verify-purchase`, `play-notifications`; not deployed until Play Console is set up), receipt photos, CSV/PDF export, and spending insights (live, deleted groups excluded). Pro hides all ads.
- **Sign-in:** one signed-in device per account (`claim-session`), sign-in alert email with device, IP and approximate location.
- **Categories:** picked from the description (`guessCategory`), sent on create and update.
- **Security:** offline cache encrypted with AES-256; old plain cache erased.
- **Build:** one Android app (flavours removed); epoch-second build numbers on Android and iOS.
- **Fixed:** signing up with an existing email showed Check your email.
- **Data:** the Supabase project was reset, so testers sign up again.

## 1.0.4 (build 10004)

- **Ads:** banner removed; interstitials at natural breaks (navigation and after adding an expense), capped by `interstitial_min_minutes` and `interstitial_skip_first`. Native ads in Groups and Friends as well as Activity. Remote Config switches per placement (`interstitial_enabled`, `native_*_enabled`) under the `ads_enabled` master switch, applied in real time.
- **Android flavours:** `dev` (`com.sharelith.app.dev`, orange icon, test ads) and `prod`. Testers get prod.
- **Icon and splash:** split coin on a teal-to-green gradient.

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
