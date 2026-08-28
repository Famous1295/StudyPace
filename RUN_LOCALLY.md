# Run Studypace on your PC

## 1. Prerequisites
- **Node.js 20+** (https://nodejs.org) — check with `node -v`
- **npm** (comes with Node) or **bun** (https://bun.sh, faster)
- A code editor (VS Code recommended)

## 2. Unzip
Unzip `studypace-source.zip` anywhere, e.g. `C:\projects\studypace`,
then open a terminal **inside that folder**.

## 3. Environment variables
The zip already includes a `.env` file with the backend connection values
(project URL + publishable key). These are safe to keep locally.
If it's missing, create `.env` in the project root with:

```
VITE_SUPABASE_URL=<your backend url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
VITE_SUPABASE_PROJECT_ID=<your project id>
SUPABASE_URL=<same as VITE_SUPABASE_URL>
SUPABASE_PUBLISHABLE_KEY=<same as VITE_SUPABASE_PUBLISHABLE_KEY>
SUPABASE_PROJECT_ID=<same as VITE_SUPABASE_PROJECT_ID>
```

## 4. Install dependencies
```bash
npm install
# or: bun install
```

## 5. Start the dev server
```bash
npm run dev
```
Open the printed URL (default **http://localhost:8080**).

## 6. Production build (optional)
```bash
npm run build
npm run preview
```

## 7. Using the app
- Register a new account at `/auth` — public signups are always **Student**.
- Student pages: `/dashboard`, `/tasks`, `/subjects`, `/timeline`.
- Admin panel at `/admin` — requires an account with the `admin` role
  (created by an existing admin under Admin → User Management → Add User).

## 8. Database
The app talks to the hosted cloud backend, so no local database is needed.
All SQL migrations are in `supabase/migrations/` for reference if you ever
want to point it at your own Supabase project (then update `.env`
and re-run the migrations there).

## Troubleshooting
- **Port in use** — change the port in `vite.config.ts` or run `npm run dev -- --port 3000`.
- **Blank page / auth errors** — confirm `.env` exists and restart the dev server
  (Vite only reads env vars at startup).
- **`node-gyp` / install errors** — make sure you're on Node 20 or newer, delete
  `node_modules` and `package-lock.json`, then `npm install` again.
