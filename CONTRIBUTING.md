# Development Workflow

## Overview

```
feature branch → local dev → push to GitHub → Vercel preview → merge to main → auto-deploy
```

---

## Step-by-Step

### 1. Start a new feature

Always branch off `main`:

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

Branch naming:
- `feature/` — new functionality
- `fix/` — bug fixes
- `chore/` — non-code changes (deps, docs, config)

---

### 2. Develop locally

Start the dev server:

```bash
npm run dev
```

Your `.env.local` points to the live Supabase project. There is no separate dev database — test carefully and clean up any test data when done.

**If your change requires a DB schema change:**
1. Write the SQL migration file in `supabase/migrations/` with the next sequential number (e.g. `00008_my_change.sql`)
2. Run it in the Supabase dashboard SQL editor
3. Commit the migration file alongside the code change

---

### 3. Push your branch

```bash
git add -A
git commit -m "Short description of what and why"
git push origin feature/your-feature-name
```

Vercel automatically builds a **preview deployment** for every branch push. The preview URL appears in the Vercel dashboard and is the best place to test auth flows and mobile layout before merging.

---

### 4. Merge to main → production

When the feature is ready and tested on the preview URL:

```bash
git checkout main
git merge feature/your-feature-name
git push origin main
```

Pushing to `main` triggers an automatic production deployment to [jabsypicks.com](https://jabsypicks.com). No manual `vercel deploy` needed.

Clean up the branch after merging:

```bash
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

---

## Local vs Production Differences

Some things behave differently locally and require one-time setup to work.

### Google OAuth (one-time setup)

Google OAuth blocks sign-in from unregistered redirect URIs. By default, only `jabsypicks.com` is registered. To enable Google sign-in locally:

1. **Google Cloud Console** → APIs & Services → Credentials → your OAuth client  
   → Authorized redirect URIs → Add `http://localhost:3000/auth/callback`

2. **Supabase dashboard** → Authentication → URL Configuration → Redirect URLs  
   → Add `http://localhost:3000/**`

After this one-time setup, Google OAuth works identically locally and on production.

### Email confirmation links

Email confirmation and magic links use `NEXT_PUBLIC_APP_URL` as the base URL. Make sure `.env.local` has:

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Without this, email links will point to `jabsypicks.com` instead of localhost, so clicking them won't redirect back to your local server.

### What works identically locally

- All server actions and server components
- Supabase database queries and RLS policies
- Supabase Storage (avatars, fighters)
- Cookies and session handling
- Email/password auth (after `NEXT_PUBLIC_APP_URL` is set)
- Invite flow and code joining

### What to test on the Vercel preview URL instead of locally

- **Full Google OAuth flow** — if you haven't done the one-time setup above
- **Mobile layout** — easier to test on a real URL than localhost
- **OG images and metadata** — social preview cards require a public URL
- **Any change that touches auth redirects** — safer to verify on a real domain

---

## Rules

- **Never commit directly to `main`** — always use a branch
- **Never commit `.env` files** — all secrets live in Vercel dashboard only
- **Always save DB migrations** to `supabase/migrations/` so schema history is tracked in git
- **Test on the Vercel preview URL** before merging, especially for auth and mobile changes
- **Clean up test data** created during local development

---

## Environment Variables

All secrets are managed in the **Vercel dashboard** under Project → Settings → Environment Variables. They are never stored in the repo.

To run locally, copy `.env.local.example` to `.env.local` and fill in the values from the Vercel dashboard or Supabase project settings:

```bash
cp .env.local.example .env.local
```

| Variable | Local value | Production value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as production | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as production | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as production | Supabase service role key |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://jabsypicks.com` |

---

## Deploying Hotfixes

Same process as any feature — no shortcuts to committing directly to `main`:

```bash
git checkout main
git checkout -b fix/urgent-fix
# make the fix
git commit -m "fix: description"
git push origin fix/urgent-fix
# verify on Vercel preview URL
git checkout main
git merge fix/urgent-fix
git push origin main
```
