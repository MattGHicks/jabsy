# Jabsy — Fantasy MMA Picks App

A full-stack fantasy picks app for UFC/MMA events. Users join leagues, make picks on individual fights, and compete on a live leaderboard.

**Live at:** [jabsypicks.com](https://jabsypicks.com)

---

## Features

- **Leagues** — Create private leagues and invite friends via shareable invite links or 8-character codes
- **Picks** — Pick winner, method (KO/Sub/Decision), and round for each fight
- **Scoring** — 5pts correct winner · +3 correct method · +2 correct round (KO/Sub only)
- **Leaderboard** — Live board updates as fight results are entered
- **Admin tools** — Create events, manage fights, enter results, trigger scoring
- **Auth** — Google OAuth + email/password via Supabase Auth
- **Invite system** — Shareable links + code-based joining (works around in-app browser issues)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, Server Actions) |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth (Google OAuth + email) |
| Styling | Tailwind CSS v4 |
| Deployment | Vercel |
| Language | TypeScript |

---

## Project Structure

```
src/
├── actions/          # Server actions (auth, leagues, picks, invites, admin)
├── app/
│   ├── (auth)/       # Public auth routes (login, signup, onboarding)
│   ├── (protected)/  # Authed routes with NavBar (dashboard, leagues, admin, profile)
│   ├── api/          # API routes (Google OAuth, scoring endpoint)
│   └── invite/       # Public invite landing page
├── components/       # Shared UI components
├── lib/              # Supabase clients, utils, scoring logic
└── types/            # TypeScript types (DB schema, app types)
supabase/
└── migrations/       # All SQL migrations in order
```

---

## Database Schema

8 tables managed via Supabase with Row Level Security:

- `profiles` — User profiles (username, avatar, role)
- `events` — UFC/MMA events
- `fights` — Individual fights within events (with results)
- `leagues` — Pick'em leagues
- `league_members` — League membership
- `league_events` — Events assigned to leagues
- `invites` — Invite codes for leagues
- `picks` — User picks per fight

### Scoring Function

`recalculate_event_picks(p_event_id uuid)` — PL/pgSQL function that calculates points for all picks in an event once results are entered.

---

## Local Development

### Prerequisites

- Node.js 18+
- A Supabase project
- Google OAuth credentials (for Google sign-in)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/MattGHicks/jabsy.git
   cd jabsy
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.local.example` to `.env.local` and fill in your values:
   ```bash
   cp .env.local.example .env.local
   ```

   | Variable | Description |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, never expose client-side) |
   | `NEXT_PUBLIC_APP_URL` | App base URL (e.g. `http://localhost:3000`) |

   > **Never commit `.env.local` or any file containing real keys.**

3. **Run database migrations**

   Run the SQL files in `supabase/migrations/` in order against your Supabase project (via the Supabase dashboard SQL editor or CLI).

4. **Configure Google OAuth**

   In your Supabase project: Authentication → Providers → Google. Add your Google OAuth client ID and secret. Set the redirect URL to `https://<your-domain>/auth/callback`.

5. **Start the dev server**
   ```bash
   npm run dev
   ```

---

## Deployment

Deployed on Vercel. All environment variables are configured in the Vercel dashboard — never stored in the repo.

```bash
vercel deploy --prod
```

---

## Admin Access

Admin role is assigned automatically via a database trigger when a user signs up with the designated admin email address. Admins can:

- Create and manage events
- Add fights to events
- Enter fight results
- Trigger scoring for completed events

---

## Invite System

Users can join leagues two ways:

1. **Invite link** — `jabsypicks.com/invite/[CODE]` — shareable URL
2. **Enter code** — 8-character code entered directly on the dashboard (useful when link sharing via apps like Facebook Messenger that mangle URLs or block OAuth in their in-app browser)

---

## Environment Variables

See `.env.local.example` for the full list of required variables. All secrets are managed via Vercel environment variables in production and must **never** be committed to the repository.
