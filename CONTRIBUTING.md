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

Vercel will automatically build a **preview deployment** for every branch push. The preview URL will appear in the Vercel dashboard and can be used to test on mobile or share for review.

---

### 4. Merge to main → production

When the feature is ready and tested on preview:

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

## Rules

- **Never commit directly to `main`** — always use a branch
- **Never commit `.env` files** — all secrets live in Vercel dashboard only
- **Always save DB migrations** to `supabase/migrations/` so schema history is tracked in git
- **Test on the Vercel preview URL** before merging, especially for mobile layout changes
- **Clean up test data** created during local development

---

## Environment Variables

All secrets are managed in the **Vercel dashboard** under Project → Settings → Environment Variables. They are never stored in the repo.

To run locally, copy `.env.local.example` to `.env.local` and fill in the values from the Vercel dashboard or Supabase project settings.

```bash
cp .env.local.example .env.local
```

---

## Deploying Hotfixes

For urgent fixes that need to go straight to production:

```bash
git checkout main
git checkout -b fix/urgent-fix
# make the fix
git commit -m "fix: description"
git push origin fix/urgent-fix
# verify on preview URL
git checkout main
git merge fix/urgent-fix
git push origin main
```

Same process — branch, verify on preview, merge. Even for hotfixes.
