# Sandy's Snacks App

A Next.js portal for Sandy's office snack subscription. The app handles member onboarding, authentication, snack catalog management, and manual payment tracking backed by Supabase. This document explains how to run the project locally, configure Supabase, and ship builds to Vercel.

## Tech stack

- [Next.js 15](https://nextjs.org/) with the App Router
- React 19 with TypeScript
- Supabase (Auth, Postgres, and Storage)
- Tailwind CSS (via the Tailwind 4 PostCSS preset)

## Getting started

1. **Install prerequisites**
   - Node.js 18.18 or newer (Next.js 15 requirement). Using the active LTS (20.x) is recommended.
   - npm 9+ (ships with recent Node.js releases).
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Create your environment file**
   ```bash
   cp .env.local.example .env.local # if you keep a template
   # otherwise create .env.local and add the variables listed below
   ```
4. **Run the development server**
   ```bash
   npm run dev
   ```
5. Visit [http://localhost:3000](http://localhost:3000) to load the app.

## Environment variables

Define the following keys in `.env.local` for local development and in Vercel project settings for preview/production:

| Variable | Required? | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public API key. |
| `SUPABASE_URL` | ✅ | Duplicate of `NEXT_PUBLIC_SUPABASE_URL` so server components and route handlers can read it. |
| `SUPABASE_ANON_KEY` | ✅ | Duplicate of `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |

The duplicated `SUPABASE_*` variables let `@supabase/auth-helpers-nextjs` authenticate inside route handlers that do not automatically receive `NEXT_PUBLIC_*` values.

After setting variables locally, restart `npm run dev` so Next.js picks them up.

## Supabase configuration

1. **Create the project**
   - Create a new Supabase project (region of your choice) and copy the project URL and anon key into your `.env.local` file.
   - In **Authentication → URL Configuration**, add the following URLs so email links and OAuth redirects succeed:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/auth/callback/magicLink`
     - `https://sandys-snacks-staging.vercel.app/auth/callback`
     - `https://sandys-snacks-staging.vercel.app/auth/callback/magicLink`
     - `https://sandys-snacks.vercel.app/auth/callback`
     - `https://sandys-snacks.vercel.app/auth/callback/magicLink`
     - Any custom domains you connect to Vercel (see below).

2. **Create the database schema**

   Run the SQL below in the Supabase SQL editor to create the required tables:

   ```sql
   create table if not exists public.profiles (
     id uuid primary key references auth.users (id) on delete cascade,
     email text not null,
     full_name text,
     dietary_preferences text,
     role text default 'member',
     created_at timestamp with time zone default now()
   );

   create table if not exists public.payments_manual (
     user_id uuid references public.profiles (id) on delete cascade,
     month text not null,
     paid boolean default false,
     note text,
     created_at timestamp with time zone default now(),
     primary key (user_id, month)
   );

   create table if not exists public.snacks (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     description text,
     photo_url text,
     created_at timestamp with time zone default now()
   );
   ```

3. **Enable Row Level Security (RLS) and policies**

   ```sql
   alter table public.profiles enable row level security;
   alter table public.payments_manual enable row level security;
   alter table public.snacks enable row level security;

   -- Profiles: people manage their own profile, admins see everything
   create policy "profiles self access" on public.profiles
     for select using (auth.uid() = id);
   create policy "profiles self upsert" on public.profiles
     for insert with check (auth.uid() = id);
   create policy "profiles admin access" on public.profiles
     for all using (
       exists (
         select 1 from public.profiles as admin
         where admin.id = auth.uid() and admin.role = 'admin'
       )
     );

   -- Payments: members read their record, admins manage everyone
   create policy "payments self read" on public.payments_manual
     for select using (auth.uid() = user_id);
   create policy "payments admin manage" on public.payments_manual
     for all using (
       exists (
         select 1 from public.profiles as admin
         where admin.id = auth.uid() and admin.role = 'admin'
       )
     );

   -- Snacks: authenticated users read; admins create/update
   create policy "snacks authenticated read" on public.snacks
     for select using (auth.role() = 'authenticated');
   create policy "snacks admin manage" on public.snacks
     for all using (
       exists (
         select 1 from public.profiles as admin
         where admin.id = auth.uid() and admin.role = 'admin'
       )
     ) with check (
       exists (
         select 1 from public.profiles as admin
         where admin.id = auth.uid() and admin.role = 'admin'
       )
     );
   ```

   After the first admin signs in, promote their profile:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

4. **Create a public storage bucket**

   ```sql
   insert into storage.buckets (id, name, public) values ('snacks', 'snacks', true)
     on conflict (id) do nothing;
   ```

   Add storage policies so anyone can see snack photos but only admins can upload:

   ```sql
   create policy "snack photos are public" on storage.objects
     for select using (bucket_id = 'snacks');

   create policy "admins manage snack photos" on storage.objects
     for all using (
       bucket_id = 'snacks' and
       exists (
         select 1 from public.profiles as admin
         where admin.id = auth.uid() and admin.role = 'admin'
       )
     ) with check (
       bucket_id = 'snacks' and
       exists (
         select 1 from public.profiles as admin
         where admin.id = auth.uid() and admin.role = 'admin'
       )
     );
   ```

5. **Email settings**
   - Enable email confirmation in Supabase Authentication so new sign-ups verify their address.
   - Update the email templates with Sandy’s branding if desired.

## Vercel deployment workflow

1. **Project setup**
   - Import the GitHub repository into Vercel.
   - Under *Settings → Environment Variables*, add the variables listed above to the *Production* and *Preview* environments. Use `vercel env pull .env.local` to copy them locally when needed.
   - Install the Supabase Vercel integration or manually set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for each environment.

2. **Branch to environment mapping**
   - **Production** (`main` branch) → `https://sandys-snacks.vercel.app` (aliased to the custom domain once connected).
   - **Staging** (`staging` branch) → `https://sandys-snacks-staging.vercel.app` (create the branch in Vercel and promote builds for QA).
   - **Preview** → Every pull request automatically receives a `https://sandys-snacks-git-<branch>.vercel.app` URL.

3. **Custom domain connection**
   - In Vercel, add `app.sandyssnacks.com` (or your preferred domain) to the Production environment.
   - Create a `CNAME` record in your DNS provider pointing `app.sandyssnacks.com` → `cname.vercel-dns.com`.
   - Once verified, update Supabase Authentication → Site URL/Redirect URLs with the custom domain callbacks.
   - Optionally add `staging.sandyssnacks.com` and point it to the staging deployment URL for easy QA.

4. **Deployment cadence**
   - Merge to `staging` to test against the staging Supabase environment (or reuse production credentials if you prefer a single backend).
   - Promote a staging build to production or merge to `main` when QA passes.
   - Use Vercel’s *Promote to Production* button for hotfixes when you need to ship an existing preview build without re-running CI.

## Testing

Before opening a pull request or promoting a deployment, run:

```bash
npm run lint
npm run build
```

The build step validates that Next.js can pre-render every route and that the Supabase TypeScript client compiles correctly.

## Troubleshooting

| Issue | How to resolve |
| --- | --- |
| `AuthApiError: redirect_to is not allowed` | Ensure every callback URL (localhost, staging, production, custom domains) is listed under Supabase Authentication → URL Configuration. |
| `Permission denied for table ...` | Verify the RLS policies above and confirm your admin account’s `profiles.role` is set to `admin`. Without that, the dashboard and admin panel cannot load shared data. |
| Snack image uploads fail | Confirm the `snacks` storage bucket exists, is marked public, and the storage policies allow admin inserts. Large files (>5 MB) may exceed Supabase’s default upload limit. |
| Local dev shows a redirect loop | Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set and restart the dev server. A missing session causes the home page redirect to fire immediately. |
| Preview deployment can’t authenticate | Run `vercel env pull` to sync environment variables locally, and confirm the preview URL has been added to Supabase’s redirect list. |

## Reproducing production locally

1. Pull the latest database snapshot from Supabase (e.g., `supabase db pull`) or run the SQL migrations above.
2. Seed test data (members, snacks, payment records) through the Supabase SQL editor or admin UI.
3. Start the app with `npm run dev` and sign in using Supabase email auth (magic links/password).
4. Verify the member dashboard and admin panel load snack lists, payment data, and file uploads.

With these steps you can reproduce the production environment locally, unblock new contributors, and safely ship updates through staging to production.
