# Blackathon Score Card

Hackathon submission, judging, and results platform for **BlackWPT Hackathon 2026**.

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind**
- **Supabase** (Postgres, Auth, RLS) — free tier
- **Vercel** deploy

Three-phase flow controlled by admin:
1. **Submissions** — public `/submit` form
2. **Judging** — 10 judges score each project on 6 categories
3. **Results** — aggregated leaderboard + Monte Carlo top-6

---

## Quick start

### 1. Create your Supabase project

1. Sign up at https://supabase.com (GitHub works).
2. **New project** → name it `blackathon-2026`, generate a DB password (save it), pick your region, free tier.
3. Wait ~2 minutes for provisioning.
4. In **Settings → API**, grab:
   - Project URL
   - `anon` public key
   - `service_role` key (secret — never expose)

### 2. Run the migration

In Supabase **SQL Editor → New query**, paste the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and click **Run**.
Idempotent — safe to re-run.

### 3. Configure auth

**Authentication → Providers → Email**
- Turn **Confirm email** OFF during dev (judge magic links land instantly).
- For production, turn it back on.

**Authentication → URL Configuration**
- Site URL: your deployed URL (or `http://localhost:3000` for dev).
- Add redirect URL: `${SITE_URL}/auth/callback`

### 4. Local env

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_PASSWORD=pick-something-strong
SUBMISSION_EDIT_SECRET=any-32+-random-chars
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 5. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### 6. Seed yourself as admin + add judges

1. Hit `/admin`, sign in with `ADMIN_PASSWORD`.
2. **Judges** tab → add each judge by name + email. They sign in at `/judge` with a magic link — no password.
3. **Submissions** tab → either wait for teams to submit via `/submit`, or upload your Airtable CSV export.
4. **Phase** tab → flip to `judging` to lock submissions, then to `results` (or use the **Compute Top 6** button on the Results tab) when everyone is done.

---

## The Top-6 algorithm

Three creative ideas stacked together. See [`src/lib/monte-carlo.ts`](src/lib/monte-carlo.ts).

### 1. Per-judge z-score normalization
Each judge's 5 core scores (Idea, Creativity, Build Quality, UX, Presentation) are rescaled so their mean=0 and stdev=1 before aggregation. A generous judge giving everyone 9s contributes the same weight as a harsh judge who centers at 6. Prevents bias from grader personality.

### 2. Bayesian shrinkage
Submissions scored by few judges get pulled toward the global mean using credibility `n / (n + k)` where `k = 3`. A "3 judges at 9.5/10" shouldn't outrank a "9 judges at 8.7/10".

### 3. Monte Carlo with seeded RNG
1000 trials. Each trial adds gaussian jitter (scaled by each judge's stdev) to every score, re-normalizes, re-ranks. Each submission's top-6 probability = fraction of trials it landed there. Seed is logged — results are fully reproducible.

### Selection
- Submissions with **P(top6) > 70%** auto-lock.
- Remaining slots filled by **weighted random draw** from the bubble, weights = P(top6). Reproducible via seed.

### Ice-breaker: Impact
The **Impact** category is *not* in the main total. It's used as the tie-breaker:
- **Automatic:** when two rankings are within ε = 0.25 on the normalized score, the higher Impact mean wins.
- **Manual:** if still tied, admin tie-breaks in the UI with a logged reason.

---

## Privacy model (RLS)

Supabase RLS policies ([`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)) enforce the model, not just the UI:

| Who       | Can see                                                                       |
| --------- | ----------------------------------------------------------------------------- |
| Public    | Submit form (`submissions` INSERT while phase=`submissions`)                  |
| Judges    | `submissions_public` view (no emails) + their own scores + progress counts    |
| All logged-in | `submission_aggregates()` only when phase=`results` (averages only)       |
| Admin     | Everything, including member emails + raw individual scores                   |

Judges **cannot** see other judges' individual scores — only the aggregated averages, once results are unlocked.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx              # phase-aware landing page
│   ├── submit/               # public submission form
│   ├── judge/                # magic-link auth + scoring UI
│   │   ├── page.tsx          # sign-in
│   │   ├── dashboard/        # list of all submissions
│   │   └── [id]/             # per-submission scoring page
│   ├── admin/                # shared-password admin
│   ├── auth/callback/        # OAuth code exchange
│   └── results/              # public aggregated leaderboard
├── components/shell.tsx
├── lib/
│   ├── monte-carlo.ts        # top-6 algorithm
│   ├── phase.ts              # event phase helper
│   ├── rubric.ts             # 6-category rubric definition
│   ├── submission-schema.ts  # zod validation
│   └── supabase/
│       ├── client.ts         # browser client
│       ├── server.ts         # server component / action client
│       └── admin.ts          # service-role client (server only)
└── middleware.ts             # session refresh
supabase/migrations/
└── 0001_init.sql             # schema + RLS + views + RPCs
legacy/                       # original static HTML (reference only)
```

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import into Vercel → select the repo.
3. Environment variables (all of them from `.env.local`, plus `NEXT_PUBLIC_SITE_URL` set to the Vercel URL).
4. Deploy. Add the Vercel URL to Supabase **Authentication → URL Configuration** as a redirect URL.

---

## Commands

```bash
npm run dev         # local dev server
npm run build       # production build
npm run start       # serve built app
npm run typecheck   # TS
npm run lint        # ESLint
```
