# Jabsy Fantasy MMA Picks App — Rebuild Plan

## Context

Rebuilding the Jabsy Fantasy MMA Picks app from scratch. The previous app (React + Vite SPA with direct Supabase client calls) had issues with RLS recursion, no SSR, and no proper admin separation. The new build uses Next.js App Router for proper server-side rendering, server actions, and a cleaner architecture. The frontend-design skill will be used for all UI/page creation to ensure production-grade, polished interfaces.

**Goal:** A fantasy MMA picks app where users join leagues, make fight predictions (winner/method/round), and compete on a 5-3-2 scoring system.

---

## Tech Stack

- **Next.js 15** (App Router, server components, server actions)
- **Supabase** (PostgreSQL, Auth with Google OAuth + email, Storage)
- **Tailwind CSS v4**
- **TypeScript**
- **Vercel** (deployment)
- **Key libraries:** `@supabase/ssr`, `zod`, `lucide-react`, `sonner`, `clsx` + `tailwind-merge`, `date-fns`
- **Frontend-design skill** for all UI creation

---

## User Roles

1. **Admin (Master)** — App owner. Creates/manages global UFC events and fights, enters results.
2. **League Owner** — Creates leagues, manages members, adds events to their league, generates invite links.
3. **Player** — Joins leagues via invite, makes picks on fights.

---

## Scoring System (5-3-2)

- **5 pts** — Correct winner
- **3 pts** — Correct method (KO/TKO, Submission, Decision) — only awarded if winner is correct
- **2 pts** — Correct round — only if winner AND method correct, AND method is KO/TKO or Submission (Decision is NOT eligible for round points)

---

## Project Structure

```
jabsy/
├── middleware.ts                        # Auth session refresh + route protection
├── supabase/
│   └── migrations/                     # All SQL migrations
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (dark theme, fonts)
│   │   ├── globals.css
│   │   ├── page.tsx                    # Landing page (public)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── onboarding/page.tsx
│   │   │   └── auth/callback/route.ts
│   │   ├── (protected)/
│   │   │   ├── layout.tsx              # Nav shell for authed users
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── leagues/[leagueId]/
│   │   │   │   ├── page.tsx            # League home
│   │   │   │   ├── settings/page.tsx   # League admin (owner only)
│   │   │   │   └── events/[eventId]/
│   │   │   │       ├── page.tsx        # Pick-making
│   │   │   │       └── board/page.tsx  # Leaderboard
│   │   │   └── admin/
│   │   │       ├── page.tsx            # Master event dashboard
│   │   │       ├── events/[eventId]/page.tsx  # Manage fights
│   │   │       └── results/[eventId]/page.tsx # Enter results
│   │   ├── invite/[code]/page.tsx      # Public invite join
│   │   └── api/admin/score/route.ts    # Score calculation endpoint
│   ├── lib/
│   │   ├── supabase/ (client.ts, server.ts, admin.ts, middleware.ts)
│   │   ├── scoring.ts
│   │   ├── constants.ts
│   │   └── utils.ts
│   ├── types/ (database.ts, index.ts)
│   ├── components/ (ui/, auth/, admin/, league/, picks/, board/, layout/)
│   ├── actions/ (auth.ts, admin.ts, leagues.ts, picks.ts, invites.ts, scoring.ts)
│   └── hooks/ (use-user.ts, use-realtime.ts)
```

---

## Database Schema

### profiles
- `id` (UUID, PK, FK → auth.users)
- `username` (TEXT, UNIQUE, nullable — null triggers onboarding)
- `avatar_url` (TEXT)
- `role` (TEXT: 'admin' | 'league_owner' | 'player', default 'player')
- `created_at`, `updated_at`
- Auto-created via trigger on auth.users insert; admin role assigned by email match

### events (master, admin-managed)
- `id` (UUID, PK), `name`, `start_time` (TIMESTAMPTZ), `venue`
- `status` ('upcoming' | 'live' | 'completed' | 'cancelled')
- `created_by` (FK → profiles)

### fights
- `id` (UUID, PK), `event_id` (FK → events), `bout_order`, `scheduled_rounds` (3 or 5), `weight_class`, `is_main_event`
- `red_name`, `red_record`, `red_avatar_url`
- `blue_name`, `blue_record`, `blue_avatar_url`
- `status` ('scheduled' | 'live' | 'final' | 'cancelled' | 'no_contest')
- `result_winner` ('red' | 'blue' | 'draw' | 'nc'), `result_method` ('decision' | 'ko_tko' | 'submission' | 'dq' | 'nc'), `result_round`

### leagues
- `id` (UUID, PK), `name`, `owner_id` (FK → profiles), `description`, `avatar_url`

### league_members
- `id` (UUID, PK), `league_id` (FK), `user_id` (FK), `role` ('admin' | 'member')
- UNIQUE(league_id, user_id)

### league_events (which events are in which league)
- `id` (UUID, PK), `league_id` (FK), `event_id` (FK), `added_by` (FK)
- UNIQUE(league_id, event_id)

### invites
- `id` (UUID, PK), `code` (TEXT, UNIQUE), `league_id` (FK), `created_by` (FK)
- `max_uses`, `use_count`, `expires_at`

### picks
- `id` (UUID, PK), `user_id` (FK), `fight_id` (FK), `league_id` (FK), `event_id` (FK)
- `pick_winner` ('red' | 'blue'), `pick_method` ('decision' | 'ko_tko' | 'submission'), `pick_round` (1-5, nullable)
- `points_earned` (INTEGER, calculated after results)
- UNIQUE(user_id, league_id, fight_id)

### DB scoring function
- `calculate_pick_points()` — immutable PL/pgSQL function implementing the 5-3-2 logic

---

## RLS Strategy (avoiding recursion)

- **profiles, events, fights**: SELECT open to all authenticated users; writes restricted by role
- **league_members**: SELECT uses self-join only (no reference to leagues table)
- **leagues**: SELECT references league_members (one direction only, no circular dependency)
- **picks**: SELECT shows own picks always; others' picks visible only when event is live/completed
- **picks INSERT/UPDATE**: Only allowed when event status = 'upcoming' (server-enforced lock)

---

## Auth Flow

1. Landing → Login/Signup (Google OAuth or email/password)
2. OAuth callback exchanges code for session, checks if username is set
3. No username → redirect to `/onboarding` (set username + avatar)
4. Middleware refreshes session on every request, protects `/(protected)/*` routes
5. Invite flow: `/invite/[code]` → login if needed → join league → redirect to league page

---

## Implementation Phases

### Phase 1: Foundation
1. `npx create-next-app` with TypeScript + Tailwind v4 + App Router
2. Set up Supabase project, configure `@supabase/ssr` (client/server/admin/middleware)
3. Create all SQL migrations (schema + RLS + triggers + scoring function)
4. Set up middleware for session refresh and route protection
5. Generate TypeScript types from Supabase schema
6. Configure `.env.local` and Vercel env vars

### Phase 2: Auth (use frontend-design skill for UI)
7. Landing page
8. Login/Signup pages with Google OAuth + email
9. OAuth callback route handler
10. Onboarding page (username + avatar upload)

### Phase 3: Admin Event Management (use frontend-design skill for UI)
11. Admin dashboard — list/create/edit/delete events
12. Fight management — add/edit/delete fights per event
13. Result entry — enter winner, method, round per fight
14. Score calculation API route

### Phase 4: Leagues (use frontend-design skill for UI)
15. User dashboard — list leagues
16. Create league form
17. League home page — events list, member list
18. League settings — rename, invite management
19. Add event to league modal
20. Invite system — generate code, shareable link

### Phase 5: Picks & Leaderboard (use frontend-design skill for UI)
21. Pick-making UI — fight cards with winner/method/round selectors
22. Pick locking (server-side: event must be 'upcoming')
23. Server actions for saving picks (upsert)
24. Live leaderboard — fight-by-fight picks + scores
25. Event winner display

### Phase 6: Invite Flow
26. Public invite page (`/invite/[code]`)
27. Unauthenticated flow (store pending invite, redirect after auth)
28. Authenticated flow (join immediately)

### Phase 7: Polish & Deploy
29. Mobile responsive pass
30. Dark theme refinement
31. Error handling and loading states
32. Deploy to Vercel
33. Configure production OAuth redirect URLs

---

## Verification Plan

1. **Auth:** Register via email, register via Google, login, logout, onboarding flow
2. **Admin:** Create event, add fights, enter results, verify scoring calculates correctly
3. **Leagues:** Create league, generate invite, join via invite link (as new and existing user)
4. **Picks:** Make picks, verify lock after event goes live, verify points calculation
5. **Leaderboard:** Verify correct ranking after results entered, verify picks visibility rules
6. **Deploy:** Verify Vercel deployment, test Google OAuth in production, test all flows end-to-end

---

## Reference Files from Previous App

- `jabsy-backup 2/src/routes/EventPage.tsx` — Pick-making UI pattern (winner/method/round selectors)
- `jabsy-backup 2/src/pages/EventPicksBoard.tsx` — Leaderboard design and scoring calculation
- `jabsy-backup 2/fix-all-league-policies.sql` — RLS recursion problem to avoid
