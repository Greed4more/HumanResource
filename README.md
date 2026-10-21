# AFTERCLASS

A student-only dating and connection app for Adamas University. Students sign up
with an `@stu.adamasuniversity.ac.in` email, complete a profile, upload their
college ID, and are reviewed by a moderator before they can discover, match, and
message other approved students.

AFTERCLASS is an independent project. It is not operated by or affiliated with
Adamas University.

## Stack

- React 19 + TypeScript + TanStack Start / TanStack Router / TanStack Query
- Tailwind CSS v4 + shadcn/Radix UI
- Supabase (Postgres, Auth, Storage, Realtime) accessed directly from the browser
- Vite 8 + Nitro for builds and deployment
- Vitest + Testing Library

There are no server functions or API routes. Authorization is enforced in
Postgres with RLS, triggers, column privileges, and `SECURITY DEFINER` RPCs.

## Local setup

### 1. Create a Supabase project

Create a project at [database.new](https://database.new). Note the project ref,
the project URL, and the publishable (anon) key.

### 2. Install dependencies

```sh
bun install
# or: npm install
```

### 3. Configure environment

```sh
cp .env.example .env
```

Fill in:

| Variable                 | Where to find it                                         |
| ------------------------ | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL          |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → Publishable/anon key |
| `VITE_CONTACT_EMAIL`     | Optional public address shown on `/contact`              |

The anon/publishable key is designed to be public. Never put a
`service_role`/secret key in a `VITE_*` variable.

### 4. Apply the database migrations

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migrations create every table, policy, trigger, storage bucket, and index.
They also create the private `photos` and `id-cards` buckets with size/MIME
limits.

### 5. Configure Auth

In Supabase → Authentication → URL Configuration:

- **Site URL**: `http://localhost:3000` for local development, your production
  URL once deployed.
- **Redirect URLs**: add `http://localhost:3000/**` and
  `https://YOUR_DOMAIN/**` (the app uses `/profile` and `/reset-password`).

Enable **Confirm email** in Supabase → Authentication → Providers → Email (the
local `supabase/config.toml` already enables it for `supabase start`). For a
real launch, configure custom SMTP (Resend, Postmark, SendGrid, …) in Supabase →
Authentication → Emails. Supabase's built-in SMTP is rate-limited and not meant
for production.

### 6. Grant the first admin

Sign up normally with your own student email, then run this in the Supabase SQL
editor (replace the address):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('you@stu.adamasuniversity.ac.in')
on conflict (user_id, role) do nothing;
```

The `/admin` page appears in the header for admins.

### 7. Run

```sh
bun run dev
# or: npm run dev
```

Open <http://localhost:3000>.

## Scripts

| Command             | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `bun run dev`       | Vite dev server on port 3000                              |
| `bun run build`     | Production build (client + Nitro server)                  |
| `bun run start`     | Run the built Node server from `.output/server/index.mjs` |
| `bun run typecheck` | TypeScript check                                          |
| `bun run lint`      | ESLint                                                    |
| `bun run test`      | Vitest                                                    |
| `bun run format`    | Prettier                                                  |

## Deploying

### Vercel

Vercel detects TanStack Start + Nitro automatically (the `vercel.json` in this
repo also pins the framework preset). Import the GitHub repo, then add these
environment variables for Production, Preview, and Development:

| Variable                 | Value                                  |
| ------------------------ | -------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://YOUR_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key          |
| `VITE_CONTACT_EMAIL`     | Optional public contact address        |

Leave the build command as `npm run build` and deploy. `NITRO_PRESET=vercel` is
optional because Nitro detects Vercel during the build.

After the first deploy, add the Vercel URL to Supabase Auth:

- **Site URL**: `https://your-project.vercel.app`
- **Redirect URLs**: `https://your-project.vercel.app/**` (and your custom domain
  if you add one)

Redeploy after changing environment variables; Vercel bakes `VITE_*` values into
the client at build time.

### Other hosts

The build produces a Nitro server in `.output/`. The default preset is
`node-server`:

```sh
bun run build
NODE_ENV=production bun run start
```

Set `NITRO_PRESET` for a platform-specific adapter, for example:

- Vercel: `NITRO_PRESET=vercel`
- Netlify: `NITRO_PRESET=netlify`
- Cloudflare Pages/Workers: `NITRO_PRESET=cloudflare-pages` or
  `cloudflare_module`

Configure the same `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
`VITE_CONTACT_EMAIL` variables in the host's build environment, then add the
production URL to Supabase Auth's Site URL and Redirect URLs.

You can host the app anywhere that runs Node (or the matching Nitro preset).
Supabase remains the database, auth, and file storage provider.

## Security model

- Signup is restricted to `@stu.adamasuniversity.ac.in` by a database trigger.
- Profiles are visible only to approved users; blocked users are excluded.
- Likes are private. A match is created by a trigger only when both likes exist.
- Messages are readable/writable only by the two matched participants, and only
  while the sender is approved.
- `profiles.email` is not granted to `authenticated`. Moderators read emails
  through admin-only RPCs.
- Photos and ID cards are private buckets. Reads use one-hour signed URLs.
- Only admins can approve/reject IDs, read reports, suspend accounts, or see ID
  cards.
- Basic DB rate limits cover swipes, messages, and reports.
- A super like includes a short message, counts as a like, and is limited to one
  per sender per day (IST) by a database constraint and trigger.

## Data migration from a previous deployment

If you have access to the previous database connection string, dump and restore the
`public` schema data (not the schema itself) into the new project after running
the migrations. Storage objects must be copied separately with the Supabase
Storage API or dashboard. If you do not have access, start fresh — the old
environment cannot be managed independently.

## Project layout

```
src/
  routes/                 file-based routes
    _authenticated/       discover, matches, chat, profile, admin, people/$userId
  components/afterclass/  shared shell, profile card, landing/info pages
  components/ui/          shadcn/Radix primitives
  integrations/supabase/  browser client + generated database types
  lib/                    queries, profile limits, moderation helpers
supabase/
  migrations/             full database history (apply with Supabase CLI)
```

## Remaining operational tasks

- Set `VITE_CONTACT_EMAIL` once the public contact address is ready (the only
  unchecked item in `roadmap.md`).
- Configure custom SMTP before inviting real users.
- If you need account deletion that also removes storage objects, add a
  Supabase Edge Function using the service role; browser code must never hold a
  service-role key.
