# SAT Vocab Online

Full-stack SAT vocabulary trainer built with Next.js App Router, Auth.js (Google), Prisma, and Vercel Postgres.

## Architecture

- `app/`: App Router pages and API routes
  - `app/api/auth/[...nextauth]/route.ts`: Auth.js endpoint
  - `app/api/progress/route.ts`: Signed-in progress fetch + sync
  - `app/api/progress/merge/route.ts`: Guest-to-account merge endpoint
- `components/`: Reusable UI (question card, nav, merge prompt, stats)
- `lib/`: Shared server/client types and domain logic
  - `lib/auth.ts`: Auth.js config with Google OAuth and Prisma adapter
  - `lib/db-progress.ts`: DB snapshot read/write + merge logic
  - `lib/snapshot.ts`: Snapshot normalization + merge + streak update
- `prisma/`: Prisma schema and seed script
- `public/data/sat_vocab.csv`: SAT vocabulary dataset
- `utils/`: CSV loader, local storage helpers, study engine, and client hooks

## Guest vs Account Storage

- Guest mode:
  - Progress is stored only in browser storage (`localStorage`)
  - Works without sign-in
  - Device-specific
- Signed-in mode:
  - Progress is persisted in Vercel Postgres via Prisma
  - Synced across devices using account identity
  - Uses local cache + pending-sync queue for offline resilience

Study progress is **not** stored in cookies. Cookies are only used by Auth.js session handling.

## Authentication (Google OAuth with Auth.js)

1. Create OAuth credentials in Google Cloud Console.
1. Add authorized redirect URI:
   - `http://localhost:3000/api/auth/callback/google` (local)
   - `https://<your-vercel-domain>/api/auth/callback/google` (production)
1. Set environment variables:
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
   - `AUTH_SECRET`

## Prisma + Vercel Postgres Setup

1. Create a Vercel Postgres database in your Vercel project.
1. Set:
   - `DATABASE_URL` to pooled Prisma connection string
   - `DIRECT_URL` to direct non-pooled connection string
1. Push schema:

```bash
npm run db:push
```

1. Seed words and achievement catalog:

```bash
npm run db:seed
```

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Required:

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `DATABASE_URL`
- `DIRECT_URL`

Optional:

- `NEXTAUTH_URL` (`http://localhost:3000` for local dev)

## Local Development

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Vercel Deployment Steps

1. Push this folder to a Git repo.
1. Import the repo into Vercel.
1. Add Vercel Postgres integration.
1. Add Google/Auth env vars to Vercel project settings.
1. Redeploy.

The app includes Vercel Speed Insights in `app/layout.tsx`:

```ts
import { SpeedInsights } from "@vercel/speed-insights/next";
```

## Guest -> Account Merge Flow

If guest data exists and the user later signs in, the app prompts:

1. Keep account progress
1. Replace account progress with local guest progress
1. Merge both datasets

Merge logic is handled server-side in `app/api/progress/merge/route.ts` using snapshot-safe reconciliation.

## Supported Study Features

- Multiple choice only
- Word -> Definition
- Definition -> Word
- Sentence context
- Mixed mode
- Weak words mode
- Missed words mode
- Bookmarked words
- Recent words
- Adaptive weak-word prioritization
- Retry once on incorrect answer
- Dashboard analytics
- Word library
- Session history
- Achievements
- Streak tracking

## CSV Data Compatibility

Dataset loader supports headers mapped to:

- `word`
- `definition`
- `example sentence` (or `example_sentence`, `sentence`, `example`, `context`)

Loader utilities:

- Client: `utils/vocab-loader.ts`
- Server: `utils/server-vocab-loader.ts`

