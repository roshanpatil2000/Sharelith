# Sharelith — Splitwise-style expense splitter (React Native CLI)

## Context
`/Users/roshan/Documents/dev/personal/Sharelith` is empty. Goal: build a React Native CLI app that reproduces Splitwise's feature set (free + Pro), feature by feature, on iOS and Android together. Use our own name (Sharelith), logo, and colors rather than Splitwise's branding; the flows and behavior match Splitwise.

**Decisions:** TypeScript · Zustand (UI/session state) + TanStack Query (server state) · Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) · iOS + Android from day one · Core + Pro scope.

## Tech stack
| Concern | Choice |
|---|---|
| Scaffold | `npx @react-native-community/cli init Sharelith` (New Architecture on) |
| Navigation | React Navigation 7: native-stack + bottom-tabs |
| UI | Own design tokens + `react-native-reanimated`, `react-native-gesture-handler`, `@gorhom/bottom-sheet`, `react-native-svg`, vector icons |
| Forms | `react-hook-form` + `zod` |
| Data | `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `react-native-mmkv` (persist + query cache) |
| Money | Integer minor units (paise/cents) everywhere; `dinero.js` or own helpers; never floats |
| Dates | `date-fns` |
| Media | `react-native-image-picker`, `react-native-vision-camera` (receipts) |
| Push | `@react-native-firebase/messaging` (FCM/APNs) triggered by Supabase Edge Functions |
| Charts | `victory-native` (Skia) |
| Testing | Jest + RNTL (units/components), Maestro (E2E flows), pgTAP / SQL tests for RLS |
| Quality | ESLint, Prettier, TS strict, Husky + lint-staged |

## Project layout
```
src/
  app/            navigation, providers, theme
  features/       auth, friends, groups, expenses, settle, activity, account, pro
    <feature>/    screens/, components/, api.ts (queries/mutations), hooks.ts, types.ts
  domain/         pure logic: money.ts, split.ts, balances.ts, simplify.ts, currency.ts
  lib/            supabase.ts, queryClient.ts, storage.ts, notifications.ts
  components/     shared UI kit (Button, Avatar, AmountText, ListRow, EmptyState…)
supabase/
  migrations/     SQL schema + RLS + views/RPCs
  functions/      edge functions (notifications, receipt OCR, fx rates, recurring, export)
```
Rule: all split/balance math lives in `src/domain` as pure, unit-tested functions, mirrored by SQL views/RPCs as the source of truth.

## Design system (built in Phase 0, used by every screen)
Lives in `src/app/theme/` (tokens) and `src/components/` (UI kit). Screens never use raw hex values, font sizes or magic spacing — only tokens and kit components. A `useTheme()` hook returns the active light/dark token set; `ThemeProvider` follows the system setting, with an override in Account settings.

### Color palette (`theme/colors.ts`)
Original palette (not Splitwise's). Semantic money colors are the most important: **green = you are owed, orange = you owe, grey = settled**.

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#1E9E83` | `#34C7A5` | Brand, primary buttons, FAB, active tab |
| `primaryPressed` | `#16806A` | `#2AA88B` | Pressed states |
| `primarySoft` | `#E3F5F0` | `#13332C` | Selected chips, highlights |
| `accent` | `#5B5BD6` | `#8B8BF0` | Pro badge, links, charts series 2 |
| `positive` (owed) | `#1E9E83` | `#34C7A5` | "owes you", "you are owed" |
| `negative` (owe) | `#E8642C` | `#FF8A50` | "you owe" |
| `danger` | `#D93A3A` | `#FF6B6B` | Delete, errors, validation |
| `warning` | `#E0A400` | `#F5C542` | Unsettled reminders, offline banner |
| `neutral` (settled) | `#8A9099` | `#7C838C` | "settled up", disabled amounts |
| `background` | `#FFFFFF` | `#0F1214` | Screen background |
| `surface` | `#F6F7F8` | `#181C1F` | Cards, sheets, list section headers |
| `surfaceRaised` | `#FFFFFF` | `#20252A` | Bottom sheets, modals |
| `border` | `#E3E6E9` | `#2B3136` | Dividers, input borders |
| `textPrimary` | `#15191C` | `#F2F4F5` | Titles, body |
| `textSecondary` | `#5E666E` | `#A5ADB4` | Subtitles, meta |
| `textOnPrimary` | `#FFFFFF` | `#0F1214` | Text on primary fills |
| `category.*` | 8 hues (food, home, transport, entertainment, utilities, life, travel, general) | lighter variants | Category icon tiles, chart slices |

Also: `spacing` (4-pt scale: 4, 8, 12, 16, 20, 24, 32, 40), `radius` (sm 6, md 10, lg 16, pill 999), `typography` (Inter or system font; `display 28/34`, `title 20/26`, `heading 17/22 semibold`, `body 15/20`, `caption 13/18`, `amount` tabular-nums), `elevation` (0–3, platform-correct shadow/elevation), `zIndex`, `motion` (durations + spring configs for Reanimated).

### Reusable components (`src/components/`)
Each component is typed, themed, accessible (labels, 44pt hit targets), and has a Jest/RNTL test. Grouped by layer:

- **Primitives:** `Text` (variant prop maps to typography tokens), `Box`/`Stack`/`Row` (spacing-token props), `Icon`, `Pressable` (haptics + pressed style), `Divider`, `Spacer`.
- **Inputs:** `Button` (primary/secondary/ghost/danger, sizes, loading), `IconButton`, `TextField` (label, error, helper; wired to react-hook-form via `FormTextField`), `AmountInput` (big numeric entry with currency prefix, minor-unit safe), `CurrencyPicker`, `DatePickerField`, `SearchBar`, `Switch`, `Checkbox`, `SegmentedControl` (split-type tabs), `Chip` / `ChipGroup` (participant chips).
- **Data display:** `Avatar` (image or initials, sizes) + `AvatarStack`, `GroupCover`, `CategoryIcon`, `AmountText` (formats minor units per locale and colors itself positive/negative/neutral), `BalanceSummary` ("you owe / you are owed" lines), `Badge` (Pro, unread count), `ListRow` (leading avatar/icon, title, subtitle, trailing amount — used by friends, groups, expenses, activity), `SectionHeader` (month headers), `Card`, `EmptyState`, `Skeleton`.
- **Feedback & overlays:** `BottomSheet` (gorhom wrapper), `Modal`, `ConfirmDialog`, `Toast`, `Banner` (offline / settle reminder), `LoadingOverlay`, `ErrorView` (retry).
- **Layout & navigation:** `Screen` (safe area, background, scroll/keyboard handling), `Header` (title, back, actions), `FAB` (Add expense), `TabBarIcon`, `PullToRefreshList` (FlashList wrapper with refresh, empty, and skeleton states).
- **Domain composites** (built in the feature phases from the kit above, kept in `features/*/components`): `ParticipantPicker`, `SplitEditor`, `PaidByPicker`, `ExpenseListItem`, `BalanceBreakdown`, `SettleUpCard`, `ActivityItem`, `CommentThread`, `ReceiptThumbnail`.

A `Storybook` for React Native (`@storybook/react-native`) showcases every kit component in light and dark mode, so the palette and components can be reviewed in isolation before screens are built.

## Data model (Supabase / Postgres)
- `profiles` (id = auth.uid, name, email, phone, avatar_url, default_currency, locale, timezone)
- `friendships` (user_a, user_b, created_at) — canonical ordered pair
- `invites` (email/phone, invited_by, group_id?, token, status) — non-registered "placeholder" users
- `groups` (id, name, type: home/trip/couple/other, cover_url, simplify_debts bool, default_split jsonb, created_by)
- `group_members` (group_id, user_id, joined_at, left_at)
- `expenses` (id, group_id nullable, description, amount_minor, currency, category_id, date, notes, receipt_url, created_by, is_payment bool, recurring_id?, deleted_at)
- `expense_payers` (expense_id, user_id, paid_minor) — supports multiple payers
- `expense_shares` (expense_id, user_id, owed_minor, split_type, raw_value) — raw_value keeps %, shares, adjustment input for editing
- `expense_items` (itemized: expense_id, name, amount_minor) + `expense_item_shares`
- `comments` (expense_id, user_id, body, created_at)
- `activity` (id, actor_id, verb, subject_type, subject_id, group_id, payload jsonb, created_at) + `activity_recipients`
- `categories` (Splitwise's category tree: Entertainment, Food & drink, Home, Life, Transportation, Utilities, Uncategorized + subcategories)
- `recurring_rules` (expense template, interval, next_run_at)
- `fx_rates` (base, quote, rate, date)
- `push_tokens`, `notification_prefs`
- Views/RPCs: `pairwise_balances` (per currency, per group & non-group), `group_balances`, `simplified_debts(group_id)`, `user_totals`

RLS: users see expenses where they're a payer/sharer or group member; edits limited to participants; everything audited into `activity` via triggers.

## Core domain logic (`src/domain`)
- **Split types** (exactly as Splitwise): equally (with per-person include toggles), exact amounts, percentages, shares, adjustments (+/−), itemized ("split by item"), plus multiple payers. Rounding: distribute leftover minor units deterministically (largest remainder) so totals always reconcile.
- **Balances:** net per user = paid − owed, per currency; pairwise "you owe / owes you".
- **Simplify debts:** greedy min-cash-flow on group net balances (match largest creditor with largest debtor), per currency; toggle per group.
- **Currency:** multi-currency balances shown separately; Pro: convert to default currency using `fx_rates`.

---

## Phased roadmap (each phase ends with a demo-able, tested app)

### Phase 0 — Foundation
1. Init RN CLI project (TS), git init, ESLint/Prettier/Husky, path aliases (`@/`).
2. Run on iOS Simulator and Android Emulator; set up app icon/splash, bundle ids, env config (`react-native-config`) for Supabase URL/anon key.
3. Design system: theme tokens + palette (light/dark), `ThemeProvider`/`useTheme`, the reusable component kit listed above, and Storybook with stories for each.
4. Navigation skeleton: Auth stack vs. Main tabs — **Friends · Groups · Activity · Account**, floating "Add expense" button.
5. Supabase project + CLI, local dev (`supabase start`), first migration, typed client (`supabase gen types`).
6. TanStack Query + MMKV persistence; Zustand session store.

### Phase 1 — Auth & profile
- Welcome screen → Sign up (name, email, password, phone, currency) / Log in / Forgot password; Google + Apple sign-in.
- Profile auto-created by trigger. Account tab: edit name/email/phone/avatar, default currency, time zone, language, notification prefs, passcode lock (biometric via `react-native-biometrics`), log out, delete account.

### Phase 2 — Friends
- Add friend by email/phone or from device contacts (`react-native-contacts`); invite non-users (placeholder profile + invite email/SMS via edge function); deep-link invite acceptance.
- Friends list with overall balance header ("Overall, you are owed ₹X"), per-friend balance row, filters (all / outstanding / owe / owed), "show settled-up friends".
- Friend detail: balance breakdown by group, shared expense list, Settle up / Remind buttons, friend settings (remove friend if settled).

### Phase 3 — Groups
- Create group (name, type, cover photo), add members (friends, contacts, invite link/QR), group settings: edit, simplify debts toggle, default split, leave group (only if settled), delete group.
- Groups list with per-group balance summary; "Non-group expenses" virtual group.
- Group detail: header with balance summary, expense list grouped by month, Balances screen, Totals screen.

### Phase 4 — Add / edit expense (the heart of the app)
- Add expense sheet: "With you and:" participant picker (friends/groups), description with auto category suggestion, amount + currency picker, "Paid by you and split equally" control.
- Paid-by screen: single payer or multiple payers with amounts.
- Split screen tabs: equally / exact / percent / shares / adjustment (live validation "₹X left"), itemized split.
- Extra: date picker, group selector, notes, receipt/photo attach, category picker.
- Expense detail: who paid/owes breakdown, edit, delete (soft) / restore, comments thread, history of edits.
- Domain unit tests for every split type + rounding; SQL RPC `create_expense` doing atomic insert of expense + payers + shares + activity.

### Phase 5 — Balances & settle up
- Settle up flow: choose who pays whom (suggested from simplified debts), amount, currency, date, group, "record payment" (stored as `is_payment` expense).
- Simplify-debts view in group balances; "Remind" sends push/email.
- Payment deep links: UPI (`upi://pay?...`), PayPal/Venmo links where available (records payment after user confirms; no in-app money movement).

### Phase 6 — Activity feed & realtime
- Activity tab: chronological feed ("X added 'Dinner' in 'Goa trip'. You owe ₹200"), unread indicators, tap to open expense/group.
- Supabase Realtime subscriptions invalidate TanStack Query caches so friends' changes appear live.

### Phase 7 — Notifications
- FCM/APNs registration, token storage, Edge Function triggered on `activity` insert → push to recipients respecting `notification_prefs`.
- Email notifications (weekly summary, added to group, payment reminders) via Resend/SMTP from edge functions.
- Deep linking from push into the right screen.

### Phase 8 — Offline & polish
- Optimistic mutations with offline queue (persisted mutations in TanStack Query), conflict handling on reconnect.
- Pull-to-refresh, skeleton loaders, empty states, haptics, accessibility labels, dark mode, i18n (`i18next`), number/currency formatting per locale.

### Phase 9 — Pro features
- **Receipt scanning:** camera capture → Storage → Edge Function OCR (Google Vision / Claude vision) → prefill amount, date, line items into itemized split.
- **Charts & graphs:** spending by category/month per group and personal (victory-native).
- **Currency conversion:** fetch daily `fx_rates` (scheduled edge function), "convert all balances to INR" action.
- **Search:** full-text search over expenses (Postgres `tsvector`) with filters.
- **Recurring expenses:** weekly/monthly/yearly rules, `pg_cron` job creates instances.
- **Export:** CSV/spreadsheet export per group (edge function → share sheet).
- **Default splits & expense templates**, multiple receipts per expense, "Pro" entitlement flag (in-app purchase later via `react-native-iap`, stubbed initially).

### Phase 10 — Release
- Crash reporting (Sentry), analytics, Fastlane for builds, TestFlight + Play internal testing, privacy policy, store listings.

---

## Working cadence
Each phase is implemented in small PR-sized steps: migration → domain logic + tests → API hooks → screens → E2E flow. We'll tackle them one at a time in this order; I'll start with Phase 0 once you approve.

## Verification
- `npm run typecheck && npm run lint && npm test` (domain math has exhaustive unit tests: split types, rounding, multi-payer, simplify-debts, multi-currency).
- `supabase db reset` + SQL tests for RLS (user A cannot read B's unrelated expenses) and balance views.
- Run on iOS Simulator and Android Emulator each phase; Maestro flows: sign up → add friend → create group → add expense (each split type) → settle up → balances reach zero.
- Two-device/two-account manual check for realtime updates and push notifications.
