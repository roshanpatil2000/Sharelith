# sharelith.techbeas.co.in

Static site whose only job is to forward Supabase email links into the app.

- `/auth/callback` receives `?code=…&next=verify|reset` from Supabase and
  redirects to `sharelith://auth/callback?…`. The app exchanges the code for a
  session (PKCE), so the link only works on the phone that requested it.
- No build step. Deploy this folder as-is on Vercel, Netlify or Cloudflare
  Pages; `vercel.json` / `_headers` set security headers for each host.

Later (Phase 1b): add `.well-known/apple-app-site-association` and
`.well-known/assetlinks.json` here so links open the app directly.
