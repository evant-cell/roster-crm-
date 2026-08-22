# Roster

Single-user CRM. Cloudflare Pages Functions backend, Supabase Postgres via PostgREST, Google OAuth for sign-in and Gmail send.

## 1. Supabase project

1. Create a new project at supabase.com.
2. Open the SQL editor and run the contents of `supabase/schema.sql` once. This creates `leads`, `activities`, `settings`, indexes, the `updated_at` trigger, and seeds default settings.
3. Under Project Settings, API, copy the project URL (`SUPABASE_URL`) and the `service_role` key (`SUPABASE_SERVICE_KEY`). The service-role key is secret, it bypasses row-level security. It is only ever used from Cloudflare Functions, never from the browser.

## 2. Google Cloud OAuth client

1. In Google Cloud Console, create (or reuse) a project, then go to APIs and Services, Credentials.
2. Create an OAuth 2.0 Client ID, type Web application.
3. Add these Authorized redirect URIs:
   - `http://localhost:8788/api/auth/callback`
   - `https://<your-project>.pages.dev/api/auth/callback`
   - Add your final custom domain's callback too if you attach one later.
4. Copy the Client ID and Client Secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Under APIs and Services, Library, enable the Gmail API.
6. Under APIs and Services, OAuth consent screen, add your own Google account as a test user (the app stays in Testing mode since this is single-user).
7. Set `ALLOWED_EMAIL` to that same Google account's email address, lowercase.

## 3. Cloudflare Pages project

1. Create a KV namespace: `wrangler kv namespace create KV` and `wrangler kv namespace create KV --preview`. Put the returned IDs into `wrangler.toml` in place of the placeholders.
2. In the Cloudflare dashboard, create a Pages project connected to this GitHub repo. Build output directory: `public`. No build command needed.
3. Bind the KV namespace to the Pages project under Settings, Functions, KV namespace bindings, binding name `KV`.
4. Add these as Pages secrets (Settings, Environment variables, encrypt each one): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`. Generate `SESSION_SECRET` as a long random string, for example `openssl rand -base64 32`.
5. Set the same variables for both Production and Preview environments if you plan to use preview deploys.

## 4. Local development

1. Copy `.dev.vars.example` to `.dev.vars` and fill in every value.
2. Run `wrangler pages dev .` from the repo root.
3. Visit `http://localhost:8788`, sign in with the allowlisted Google account.

## 5. Deploying

Push to `main`:

```
git push origin main
```

Cloudflare Pages picks up the push and deploys automatically.
