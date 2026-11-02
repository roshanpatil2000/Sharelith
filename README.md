# Sharelith

A Splitwise-style expense splitter for iOS and Android, built with React Native and Supabase. The roadmap and data model are in [docs/PLAN.md](docs/PLAN.md).

**Status:** accounts, friends and groups work. Adding and splitting expenses (Phase 4) is next.

## Setup

Requires Node 22+, Xcode with CocoaPods, and Android Studio.

```sh
npm install
cp .env.example .env   # add your Supabase URL and anon key
npm run pods           # iOS, and after any native dependency change
```

## Run

```sh
npm start
npm run ios
npm run android
```

Rebuild the native app after changing `.env`; values are baked in at build time.

## Check

```sh
npm run verify        # typecheck, lint and Jest
npx supabase start    # needs Docker
npx supabase test db  # RLS tests in supabase/tests
```

CI runs both on every pull request.

## Supabase

| Command | What it does |
|---|---|
| `npm run db:new <name>` | Creates a migration |
| `npm run db:push` | Applies migrations to the linked project |
| `npm run db:types` | Regenerates `src/lib/database.types.ts` |
| `npm run functions:deploy` | Deploys Edge Functions |
| `npm run functions:secrets` | Uploads `supabase/functions/.env` |

`web/` is the static page that forwards email links into the app. See [web/README.md](web/README.md).

## Layout

```
src/app         navigation, providers, theme
src/components  shared UI kit
src/domain      pure logic, such as money
src/features    one folder per feature
src/lib         Supabase, storage, query client
supabase        migrations, Edge Functions, RLS tests
```
