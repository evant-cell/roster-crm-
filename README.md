# Roster

Small CRM for tracking leads through a pipeline. Cloudflare Pages Functions backend, Supabase Postgres via PostgREST, Google OAuth for sign-in and Gmail send. Two people use it, Evan (etaylor4391@gmail.com) and Tiana (tianamomeni@gmail.com).

## Start here if you're Claude

This section is the handoff for a fresh Claude session. Read it, then `CLAUDE.md` (hard rules), then the files named below for whatever you're changing.

### What it does

1. Leads table with search, sort, and filter chips by stage, overdue, and stale.
2. Board view, one column per stage, drag cards between columns.
3. Follow-ups view, overdue first, then today, then the next 7 days.
4. Lead drawer with editable fields, stage switcher, a 4-box qualifying checklist, an activity timeline, notes, and Gmail send.
5. CSV import (upload, match columns, review, commit) and CSV export.
6. Settings view where the user edits stage names, the checklist, Source options, custom fields, the stale threshold, and the daily digest toggle.

### How it fits together

1. `public/` is the whole frontend. Plain ES modules, no build step. `public/app.js` boots, checks auth, loads settings, and dispatches to a view module in `public/modules/`.
2. `public/modules/api.js` is the only place the frontend calls the server. It also holds a demo dataset that runs when the URL has `?demo=1`, which needs no backend or login.
3. `functions/api/` is the backend. Every route under `/api/*` except `/api/auth/*` requires a session (`functions/_middleware.js`).
4. `functions/lib/db.js` talks to Supabase with the service-role key. Nothing else touches the database.
5. `supabase/schema.sql` is the full schema. Three tables, `leads`, `activities`, and `settings` (key/value jsonb).

### What users can edit in Settings, and where it lives

All of it's stored as rows in the `settings` table, read and written through `GET` and `PUT /api/settings`. `PUT` upserts whatever keys it gets, so a new setting needs no backend change.

| Setting key | Shape | Used by |
|---|---|---|
| `stage_labels` | `{ new, contacted, qualified, contracted, lost }` display names | `applyStageLabels` in `public/modules/ui.js` overwrites `STAGE_LABEL`, so the table, board, drawer, chips, and follow-ups all show the new names. Stage-change log lines and CSV import matching read it on the server too. |
| `checklist` | array of exactly 4 strings | Qualifying checklist in the drawer |
| `source_options` | array of strings | Source dropdown in the drawer. Falls back to `DEFAULT_SOURCES` in `ui.js` when empty. |
| `custom_fields` | array of `{ key, label, type, options }` | Extra inputs in the drawer, extra columns in CSV export |
| `stale_days` | number | "No contact" flag |
| `digest` | `{ enabled, hour }` | Daily digest toggle |

Custom field types are `text`, `number`, `currency`, `date`, and `dropdown` (`FIELD_TYPES` in `ui.js`). Values are saved on each lead in the `leads.custom` jsonb column under the field's `key`. The key is generated once (`f_` plus a random suffix) and never changes, so renaming a field keeps its data. Removing a field hides it but leaves saved values in place.

### Limits worth knowing before you change things

1. Stage keys are fixed at five (`new`, `contacted`, `qualified`, `contracted`, `lost`). Only their display names are editable. Adding or removing a stage means changing the `check` constraint on `leads.stage` in Supabase (run SQL in the Supabase SQL editor), the `STAGES` lists in `public/modules/ui.js`, `functions/api/leads/index.js`, and `functions/api/leads/[id].js`, the board swatches in `public/styles.css`, and the "open" logic that treats `contracted` and `lost` as closed (`isOpen` in `ui.js`, plus the overdue and stale filters in `functions/api/leads/index.js`).
2. The checklist is exactly 4 boxes because `leads.qual` defaults to a 4-item boolean array.
3. CSV import can't map columns into custom fields yet. It only targets the built-in columns in `IMPORT_FIELDS` (`functions/lib/leads-map.js`).
4. Microsoft 365 connect and activity log export are placeholder buttons that show a toast.

### How to check a change

1. Frontend only: serve `public/` with any static server and open `/?demo=1`. Demo mode runs entirely in the browser, so settings and lead edits work without a backend and reset on reload.
2. Full stack: `wrangler pages dev .` with a filled-in `.dev.vars` (see section 4 below). Google sign-in needs `http://localhost:8788/api/auth/callback` in the OAuth client's redirect URIs.
3. Syntax check any file you touched with `node --check path/to/file.js`.

### Shipping

1. Commit to `main` in this repo (`git@github.com:evant-cell/roster-crm-.git`).
2. Pushing `main` deploys to production on Cloudflare Pages (project name `roster-crm`). Ask the user before every push.
3. If a change needs a database change, write the SQL, add it to `supabase/schema.sql` so a fresh setup matches, and give the user the exact SQL to run in the Supabase SQL editor. You can't run it from here.
4. Secrets (`GOOGLE_CLIENT_SECRET`, `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`) live in the Cloudflare dashboard. Non-secret vars, including the `ALLOWED_EMAIL` sign-in allowlist, live in `wrangler.toml`. Adding a new user means adding their email there and as a test user on the Google OAuth consent screen.

## Setup from scratch

The steps below are only needed to stand up a new copy. The live app is already set up.

## 1. Supabase project

1. Create a new project at supabase.com.
2. Open the SQL editor and run the contents of `supabase/schema.sql` once. This creates `leads`, `activities`, `settings`, indexes, the `updated_at` trigger, and seeds default settings.
3. Under Project Settings, API, copy the project URL (`SUPABASE_URL`) and the `service_role` key (`SUPABASE_SERVICE_KEY`). The service-role key is secret, it bypasses row-level security. It's only ever used from Cloudflare Functions, never from the browser.

## 2. Google Cloud OAuth client

1. In Google Cloud Console, create (or reuse) a project, then go to APIs and Services, Credentials.
2. Create an OAuth 2.0 Client ID, type Web application.
3. Add these Authorized redirect URIs.
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
