# Deploy Studypace with your own Supabase + Vercel

The zip you downloaded points at the managed cloud backend. Follow these
steps to run it on **your own Supabase project** and host the app on **Vercel**.

---

## Step 1 — Create your Supabase project

1. Go to https://supabase.com → **New project** (free plan is fine).
2. Pick a name, database password, and region. Wait ~2 minutes for it to provision.
3. Open **Project Settings → Data API** and note:
   - **Project URL** — `https://YOUR_REF.supabase.co`
   - **anon public key** (or publishable `sb_publishable_...` key)
   - **service_role key** (secret — never expose in the browser)

## Step 2 — Load the database schema

**Easiest — one single file:**
1. Open your Supabase project → **SQL Editor** → New query.
2. Paste the entire contents of `supabase/schema/full_schema.sql` and click **Run**.

That file is every migration merged in order inside one transaction, so it
either applies completely or rolls back — nothing half-applied. Run it only
once, on a brand-new empty project.

The schema can be installed without `pg_cron`; reminder schedules are skipped
with a notice. To enable daily reminders, first enable both `pg_cron` and
`pg_net`, then run the three reminder migration files again.

**Alternative — the individual migrations:**
- SQL Editor: run each file in `supabase/migrations/` in filename order
  (they are timestamped, so alphabetical = correct order).
- Or with the CLI:
```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR_REF
supabase db push
```


## Step 3 — Configure authentication

In your Supabase project → **Authentication → URL Configuration**:

- **Site URL:** `https://your-app.vercel.app` (your Vercel domain)
- **Redirect URLs:** add both:
  - `https://your-app.vercel.app/auth/callback`
  - `http://localhost:8080/auth/callback` (for local dev)

Under **Authentication → Email**: leave "Confirm email" ON to keep the
default confirmation-link flow.

## Step 4 — Point the app at your Supabase

Edit `.env` in the project root:

```
SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=<your anon/publishable key>
SUPABASE_PROJECT_ID=YOUR_REF
VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your anon/publishable key>
VITE_SUPABASE_PROJECT_ID=YOUR_REF
```

Also set the **server-only** secrets used by server functions
(e.g. weekly digest mail, Telegram bot):

```
SUPABASE_SERVICE_ROLE_KEY=<your service_role key>   # NEVER prefix with VITE_
```

Feature-specific env vars (optional, only if you use them):
- `TELEGRAM_BOT_TOKEN` — Telegram reminders bot
- Gmail/cron secrets for the Monday weekly digest

## Step 5 — Deploy to Vercel

This is a TanStack Start (SSR) app, so it deploys as a **server** app, not a
static site. Vercel supports this out of the box.

1. Push the unzipped folder to a GitHub/GitLab repo.
2. In Vercel → **Add New → Project** → import the repo.
3. Framework preset: **Other** (Vite auto-detect also works).
4. Set the build preset for the server runtime — create `vercel.json` in the
   project root:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".output/public"
}
```

   If the build doesn't auto-target Vercel, set an env var `NITRO_PRESET=vercel`
   in Vercel project settings, or in `vite.config.ts` set
   `nitro: { preset: "vercel" }` in the defineConfig options.

5. Add **Environment Variables** in Vercel project settings (same ones as
   your `.env`, including `SUPABASE_SERVICE_ROLE_KEY` — Vercel keeps it
   server-side because it has no `VITE_` prefix).
6. Deploy.

## Step 6 — First accounts

1. Register normally at `/auth` — public signups are **Student**.
2. To create an admin: sign up, then in Supabase SQL Editor run:
   ```sql
   insert into public.user_roles (user_id, role)
   values ('<that-user-id>', 'admin');
   ```
   (Get the user id from Authentication → Users.)
3. Admin portal is at `/adminportal` (and `/admin`).

## Notes / gotchas

- **Service role key** must never be in a `VITE_` variable or committed to a
  public repo. Keep it only in Vercel env settings.
- **Realtime** (task sync) works on the free Supabase plan — no extra setup.
- If a page fails with a permissions error, you likely skipped a migration —
  re-check Step 2 order.
- Telegram webhooks / cron endpoints live under `/api/public/hooks/*` on your
  Vercel domain once deployed.

---

### Alternative: static-only hosting (simpler, fewer features)

If you don't need server functions (weekly digest mail, Telegram webhooks,
admin server actions), you could strip those and deploy as a pure SPA — but
that's a bigger refactor. The SSR deploy above keeps 100% of features.
