# Jabsy

> A UFC/MMA fantasy league app — create leagues, make fight picks, compete on leaderboards.

## Status
- **Stage:** active
- **Deployed:** yes → https://jabsy.app (or Vercel URL)
- **Auto-deploy:** YES → push to `main` deploys immediately to Vercel

⚠️ **LIVE PRODUCTION APP — NEVER push directly to `main`.**
Always work on a feature branch. Open a PR and confirm before merging.

## What This Is
Jabsy is a fantasy-style prediction game for UFC/MMA events. Users join leagues, pick fight winners before each event, and compete on a scoreboard. It has an admin panel for managing events, a cron system for syncing live results, and Google auth.

## Stack
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (auth, database, migrations)
- **Auth:** Supabase Auth + Google OAuth
- **Deployment:** Vercel (auto-deploy from `main`)
- **Analytics:** Vercel Analytics

## Local Dev
```bash
npm install
npm run dev    # http://localhost:3000
```
Env vars needed: Supabase URL + anon key, Google OAuth credentials.

## Project Structure
```
src/
  app/
    (auth)/           # login, signup, onboarding, email check
    (protected)/      # requires login
      dashboard/      # main home after login
      leagues/        # league list, league detail, events, scoreboard
      admin/          # event management, scoring, search
      profile/        # user profiles
    api/
      auth/google/    # Google OAuth callback
      admin/score/    # manual scoring endpoint
      cron/
        live-results/ # syncs live fight results
        sync-cards/   # syncs fight cards
    invite/[code]/    # invite link handler
    privacy/ terms/   # legal pages
  components/
    ui/               # shadcn base components
    picks/            # pick selection UI
    board/            # scoreboard components
    auth/             # auth forms
    league/           # league UI
    admin/            # admin panel components
  hooks/              # custom React hooks
  actions/            # server actions
  lib/
    supabase/         # Supabase client (server + client)
    api/              # API helpers
  types/              # TypeScript types
supabase/
  migrations/         # DB schema — never edit prod DB directly
```

## Key Conventions
- **Styling:** Tailwind, dark mode, consistent spacing
- **DB:** All schema changes require a migration file in `supabase/migrations/`
- **Auth:** Protected routes under `(protected)/` — middleware handles redirect
- **Cron:** `/api/cron/*` routes are called by Vercel cron — don't break their signatures
- **Server actions:** Prefer `src/actions/` over inline API routes for mutations

## Design Principles
- Dark mode primary
- Clean scoreboards — clarity over decoration
- Mobile-friendly (users check scores on phone)

## Off Limits
- Never push directly to `main` — Vercel auto-deploys
- Don't modify migration files that have already run on prod
- Don't change cron route signatures without updating vercel.json
- Don't remove Google OAuth — it's the primary login method

---

## Obsidian Vault Workflow

This project is connected to a persistent knowledge base via the Obsidian MCP server.

### End of Session Routine
When the session is wrapping up, or when asked to "update vault":
1. **Update project note** — Update `projects/jabsy.md` in the Obsidian vault with:
   - Current project status
   - What was built or changed this session
   - Any blockers or open questions
2. **Write session log** — Create or append to `logs/{YYYY-MM-DD}.md` in the vault with:
   - Project name
   - Summary of work done
   - Key decisions made
   - Time spent (if mentioned)
3. **Save patterns** — If a reusable technical pattern was discovered or a non-obvious solution was found, save it to `patterns/{descriptive-name}.md` in the vault with the problem, solution, and which project it came from
4. **Save decisions** — If a significant architecture or tool decision was made, save it to `decisions/{YYYY-MM-descriptive-name}.md` in the vault with the context, options considered, and rationale

### Cross-Project Context
If you need context from other projects or past sessions, query the Obsidian vault using the MCP tools. Check:
- `projects/` for other project summaries
- `patterns/` for reusable solutions
- `logs/` for recent session history
- `decisions/` for past architecture choices

### Skills & Conventions
Before starting work, check `skills/` in the Obsidian vault for cross-project conventions that apply to this project's stack.

At the end of each session:
- If a new reusable convention, pattern, or best practice was established, create a new skill file in `skills/` in the vault
- If an existing skill was refined, improved, or contradicted by something learned this session, update the relevant skill file in `skills/` in the vault
- If a project-specific skill becomes useful across projects, promote it from this CLAUDE.md to `skills/` in the vault
