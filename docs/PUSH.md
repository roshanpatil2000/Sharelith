# Push notifications (Android)

You get a push when someone else adds, edits, deletes or restores an expense
or payment that changes your balance, or adds you to (or removes you from) a
group. Group expenses you're not on don't push.

How it works: the app registers its FCM token (`register_push_token`). Each
new `activity_recipients` row runs the `push_activity` trigger, which checks
`should_push` and calls the `send-push` edge function through pg_net. The
function writes the text and sends it through FCM HTTP v1.

## One-time setup

Never paste any of these values into chat or commit them.

1. **Firebase project.** In the Firebase console, add an Android app with
   package `com.sharelith.app`. Download `google-services.json` into
   `android/app/` (it's git-ignored). Builds without it work but get no
   pushes.
2. **Service account.** Project settings → Service accounts → Generate new
   private key. Store the whole JSON as a function secret:

   ```bash
   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat path/to/key.json)"
   ```

   Then delete the downloaded file.

3. **Webhook secret.** Make a random value and store it in two places, the
   function and Vault:

   ```bash
   openssl rand -hex 32
   ```

   ```bash
   supabase secrets set PUSH_WEBHOOK_SECRET=<value>
   ```

   In the SQL editor:

   ```sql
   select vault.create_secret('<value>', 'push_webhook_secret');
   select vault.create_secret(
     'https://<project-ref>.supabase.co/functions/v1/send-push',
     'push_function_url'
   );
   ```

4. **Deploy.** `npm run db:push`, then
   `npm run functions:deploy -- send-push` (`config.toml` turns JWT checks
   off for it).

Without the Vault entries the trigger does nothing, which is why local and CI
databases never send.

## iOS

Not yet. Firebase is excluded from iOS autolinking in
`react-native.config.js`; iOS needs `GoogleService-Info.plist`, an APNs key
in Firebase, and the push capability.
