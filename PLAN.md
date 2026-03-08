# Jabsy — Current State & Future Ideas

## Status: Production ✅

App is live at [jabsypicks.com](https://jabsypicks.com) with real users.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development workflow.

---

## Architecture Summary

- **Framework:** Next.js App Router + Server Actions
- **Auth:** Supabase Auth (Google OAuth + email/password)
- **Database:** Supabase Postgres with RLS
- **Deployment:** Vercel (auto-deploy on push to `main`)
- **Scoring:** 5pts correct winner · +3 correct method · +2 correct round (KO/Sub only)

## Route Groups

| Group | Path | Description |
|---|---|---|
| Public | `/` | Landing page |
| Auth | `/(auth)/` | Login, signup, onboarding |
| Protected | `/(protected)/` | Dashboard, leagues, admin, profile |
| Invite | `/invite/[code]` | Public invite landing |

## Key Files

| File | Purpose |
|---|---|
| `src/actions/` | All server actions (auth, picks, leagues, invites, admin) |
| `src/lib/supabase/` | Supabase client setup (server, client, admin) |
| `src/types/database.ts` | Manual DB types matching Supabase schema |
| `supabase/migrations/` | All SQL migrations in order |
| `middleware.ts` | Cookie-based route protection (no API calls) |

---

## Future Ideas

- Push notifications when picks lock / results are in
- Historical stats across multiple events
- Head-to-head comparisons between league members
- Public league discovery / open leagues
- Realtime leaderboard updates (Supabase Realtime → router.refresh)
