# Invite by text (Twilio)

On Add friend, picking a contact who has a phone number but no email shows **Invite by text**. Sharelith texts them your invite link:

> Asha invited you to split costs on Sharelith: https://sharelith.techbeas.co.in/invite/…

When they open it and sign up or log in, the existing invite flow makes you friends.

## How it works

- The app calls the `invite-by-sms` function (`supabase/functions/invite-by-sms`).
- The function:
  - checks you're signed in;
  - counts the text against the daily add-friend limit (`claim_friend_add_attempt`);
  - makes your invite link (`create_invite_link`);
  - sends the text through Twilio (`_shared/twilio.ts`).
- The phone number goes to Twilio only for that text. It isn't stored.
- If sending fails, the app offers **Send from my phone**, which opens the Messages app with the same text.

The whole feature is behind the Remote Config switch `sms_invites_enabled`, which is off by default. When it's off, phone-only contacts get only the Messages app option.

## Setup

1. In the Twilio Console, note the **Account SID** and **Auth Token**. You also need a sender: either a Twilio phone number or a Messaging Service SID.
2. Set the function secrets:
   ```bash
   npx supabase secrets set TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... TWILIO_FROM=+1...
   ```
   To use a Messaging Service instead, set `TWILIO_MESSAGING_SERVICE_SID=MG...` in place of `TWILIO_FROM`. A Messaging Service wins if both are set.
3. Deploy:
   ```bash
   npm run functions:deploy invite-by-sms
   ```
4. Publish `sms_invites_enabled = true` in Firebase Remote Config.

## Trial account limits

- A trial account texts only numbers verified under **Phone Numbers → Verified Caller IDs**. Any other number gets error 21608, and the app shows "This number can't get texts from Sharelith yet", with the Messages app option.
- Every trial message starts with "Sent from your Twilio trial account".

## India

Texts to Indian numbers need **DLT registration**: a principal entity, a sender ID (header) and an approved template for the invite text, with the link marked as a URL variable. Without it, Indian carriers may drop the messages even when Twilio reports them as sent. Set this up in Twilio's console for India before you turn the switch on for everyone.

## Error codes the app shows

| Twilio code | App message |
|---|---|
| 21608 | This number can't get texts from Sharelith yet (trial, unverified) |
| 21211, 21408, 21610, 21612, 21614 | This number can't receive texts |
| anything else | Couldn't send the text. Try again. |
