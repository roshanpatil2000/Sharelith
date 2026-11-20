# Sharelith Pro

Pro is a Google Play subscription (Android only for now) with two plans, monthly and yearly. It unlocks:
- no ads;
- receipt photos;
- export to CSV/PDF;
- insights.

## How it works

1. The **Pro screen** (Account → Sharelith Pro) loads the plans from Play (`fetchProducts`) and opens Play's subscribe sheet. The purchase is tied to the Sharelith account (`obfuscatedAccountId` = user id).
2. The app sends the purchase token to the **`verify-purchase`** edge function. It:
   - checks the token with the Play Developer API (`purchases.subscriptionsv2.get`);
   - refuses tokens bought from another account;
   - saves the row in `subscriptions`;
   - acknowledges the purchase.
   The app then finishes the transaction. The app never grants Pro itself.
3. **`play-notifications`** receives Google's Real-time Developer Notifications. For each one, it re-reads the token from Google and updates `subscriptions`, so renewals, cancellations, holds and refunds apply without the app.
4. **`is_pro(uid)`** in the database decides Pro:
   - a subscription that's active, in grace, or cancelled but not yet expired; or
   - `profiles.pro_override` (test accounts, complimentary Pro).

   The app reads it with `my_pro_status()`. Pro-only actions on the server call `require_pro()`.

Plan IDs come from Remote Config (`pro_monthly_sku`, `pro_yearly_sku`, defaults `pro_monthly` / `pro_yearly`).

## Testing without Play: give an account Pro

In the Supabase SQL editor:

```sql
update public.profiles set pro_override = true
where email = 'tester@example.com';
```

Set it back to `false` to remove Pro.

## One-time Play setup

1. **Play Console:** create the app `com.sharelith.app` and upload a release build to **Internal testing**. Billing only works for builds installed from Play.
2. **Subscriptions** (Monetize → Products → Subscriptions): create `pro_monthly` and `pro_yearly`, each with one auto-renewing base plan and a price. Activate them.
3. **License testers** (Settings → License testing): add the Google accounts that will test. Their purchases are free and renew quickly.
4. **Service account for the server:**
   - In Google Cloud (the project linked to Play Console), create a service account and download its JSON key.
   - In Play Console → Users and permissions, invite its email with *View financial data* and *Manage orders and subscriptions*.
   - Then:
     ```bash
     npx supabase secrets set PLAY_SERVICE_ACCOUNT="$(cat play-service-account.json)"
     ```
5. **Real-time notifications:**
   - Create a random secret and set it:
     ```bash
     npx supabase secrets set PLAY_NOTIFICATIONS_SECRET=<random>
     ```
   - In Google Cloud Pub/Sub, create a topic and grant `google-play-developer-notifications@system.gserviceaccount.com` the *Pub/Sub Publisher* role on it.
   - Add a **push** subscription to `https://<project-ref>.supabase.co/functions/v1/play-notifications?secret=<random>`.
   - In Play Console → Monetize → Monetization setup, set the topic and send a test notification.
6. **Deploy:**
   ```bash
   npx supabase functions deploy verify-purchase play-notifications --use-api
   ```
