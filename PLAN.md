# Nexa build plan

Status: approved 26/09/2026.

## 1. Sources and decisions

Design source: `design/project/NexaApp.dc.html` (moved from `:design/`) (all screens, copy and logic), `NexaScreens.dc.html` (375, 768 and 1280 px frames, states), `NexaComponents.dc.html` (component sheet), `HANDOFF.md` (tokens, breakpoints, accessibility, content rules) and the Jona Klassen design system tokens.

The folder is named `:design` (leading colon). A colon in a path breaks Windows checkouts and some tools, so the first commit moves it to `design/` with `git mv`. Nothing inside the folder changes.

Infrastructure already in place:

| Item | Value |
|---|---|
| Supabase project | `nexa`, ref `fauotybbzqlerctitcsc`, region `eu-west-1` (Ireland) |
| Vercel | Personal account, Hobby plan. The project is created in the auth milestone. |
| Vercel function region | `dub1` (Dublin), set in `vercel.json` |
| Usage limits | 5 brief breakdowns and 5 statement generations per project |
| Retention | 30 days after last activity or after the final deadline, whichever is later |

## 2. Stack

| Layer | Choice | Reason |
|---|---|---|
| Client | React 18, TypeScript (strict), Vite, React Router, TanStack Query | Requested stack. TanStack Query handles cache, retries and the loading, error and empty states the design specifies. |
| Styling | CSS Modules plus a `tokens.css` copied from the design system | Tokens stay the single source. No UI library, since the design has its own components. |
| Fonts | Hanken Grotesk and Source Serif 4, self hosted from `@fontsource` packages | Same fonts and weights as the design. Loading from Google Fonts sends every visitor's IP address to Google, which conflicts with data minimisation and would need a CSP exception. |
| Server | One Vercel Node function using Hono (`api/[[...route]].ts`) plus a separate function for AI routes | The Hobby plan allows 12 functions per deployment, so a single router keeps us well under that. AI routes get their own function with a 60 s timeout. |
| Validation | zod on every route, shared schemas in `shared/schemas` | The same schemas type the client. |
| Database | Supabase Postgres 17, RLS on every table, pgTAP tests | |
| AI | `@anthropic-ai/sdk`, server side only. `claude-haiku-4-5` for briefs, `claude-sonnet-5` for statements | Output is structured JSON and is validated with zod before it is returned. |
| Email | Resend (EU sending region), React Email templates | |
| PDF export | `pdf-lib` in the browser with the same fonts embedded | No server cost. The file name follows the design: `Contribution statement, <group>.pdf`. |
| QR code | `qrcode` package, SVG output | Replaces the fake QR code in the prototype. |
| PWA | `vite-plugin-pwa` (Workbox), app shell precache only | |
| Tests | Vitest (unit), pgTAP (RLS), Playwright (end to end) | |

## 3. Data model

All tables live in `public`, have RLS enabled and forced, and have no policy granting `anon` anything. Timestamps are `timestamptz`, stored in UTC and shown in Europe/Dublin time as DD/MM/YYYY HH:MM.

```
profiles            id (= auth.users.id, cascade), full_name, created_at, updated_at

groups              id, name (1..80), created_by -> profiles (set null), created_at

group_members       group_id -> groups (cascade), user_id -> profiles (cascade),
                    role ('owner' | 'member'), joined_at
                    PK (group_id, user_id). A trigger enforces a maximum of 8 members and at least one owner.

projects            id, group_id -> groups (cascade), module_code, title, final_deadline,
                    plan text default 'free',
                    brief jsonb (reviewed deliverables, deadlines, criteria; validated by a CHECK on shape),
                    last_activity_at, deletion_warned_at, created_at

brief_analyses      id, project_id (cascade), source ('pdf' | 'text'), storage_path (nullable),
                    status ('processing' | 'ready' | 'failed'), result jsonb (validated AI output),
                    error_code, created_by (set null), created_at
                    Holds the AI draft until a member reviews it. The design says "You can leave this page; the result is saved."

tasks               id, project_id (cascade), title (1..200), description (0..4000), deliverable,
                    assignee_id -> profiles (set null), due_at, estimated_hours numeric(4,1) 0..200,
                    status ('todo' | 'in_progress' | 'done'), completion_seq int, position,
                    created_by (set null), created_at, updated_at, reminder_sent_at

task_links          id, task_id (cascade), url (https only, 1..2048), host, label,
                    added_by (set null), created_at

activity_log        id bigint identity, project_id (cascade), actor_id -> profiles (set null),
                    event ('group_joined' | 'brief_uploaded' | 'tasks_created' | 'task_created' |
                           'task_status_changed' | 'task_link_added' | 'task_confirmed' |
                           'task_flagged' | 'task_assigned' | 'member_left' | 'member_removed'),
                    task_id (nullable, no cascade), task_title (snapshot), completion_seq,
                    payload jsonb (small, validated per event), created_at
                    Append only (see section 4).

statements          id, project_id (cascade), sections jsonb [{heading, body}], period_from, period_to,
                    generated_at, generated_by (set null), edited_at, edited_by (set null)

invites             id, group_id (cascade), project_id (cascade), kind ('link' | 'email'),
                    email (nullable), nonce bytea(16), code_hash bytea unique,
                    max_uses int (1..8), use_count int, expires_at (created_at + 7 days),
                    revoked_at, created_by (set null), created_at

calendar_feeds      id, user_id (cascade), project_id (cascade), nonce bytea(16), token_hash bytea unique,
                    created_at, last_read_at, revoked_at
                    One active feed per user per project, as in the design's account screen.

plan_limits         plan, kind ('brief_breakdown' | 'statement_generation'), max_per_project
                    Seeded with ('free', ..., 5). A paid tier is a new row, not a schema change.

project_usage       project_id (cascade), kind, used int, updated_at, PK (project_id, kind)

rate_limits         bucket text (HMAC of route + IP or user id), window_start, count
                    Service role only. Rows older than 24 hours are purged daily. No raw IPs are stored.
```

Reviews (confirm and flag) are stored only as `activity_log` events, so the log is the single source of truth. The task detail screen reads reviews from the log for the task's current `completion_seq`. A reviewer can respond once per completion, and the task's assignee cannot review their own task.

## 4. Row Level Security

Helper functions (`security definer`, `stable`, fixed `search_path`):
- `is_group_member(group_id)`: true when a `group_members` row exists for `auth.uid()`.
- `is_group_owner(group_id)`: the same check with role `owner`.
- `project_group(project_id)`: returns the project's group id.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | Self, and co-members of a shared group (name only; see note below) | Via auth trigger only | Self | None (account deletion goes through the server) |
| groups | Members | Through the `create_group_with_project` RPC only | Owners | Owners |
| group_members | Members of the same group | Through the accept-invite and create-group RPCs only | Owners (role changes; a trigger keeps at least one owner) | Owners (remove member), or self (leave) |
| projects | Members | Through the RPC only | Members (brief and details), owners (deadline) | Owners |
| brief_analyses | Members | None (server only) | None (server only) | None |
| tasks | Members | Members | Members | Owners, or the creator while status is `todo` |
| task_links | Members | Members, with `added_by = auth.uid()` forced by a default and a check | None | None |
| activity_log | Members | **None.** Rows are only written by triggers and definer functions. | **None** | **None** |
| statements | Members | None (server only) | Members (edit text) | Owners |
| invites | Owners of the group | None (server only, since tokens are derived server side) | Owners (revoke only, via a column-level grant on `revoked_at`) | None |
| calendar_feeds | Own rows | None (server only) | None | None |
| plan_limits | Authenticated (read only) | None | None | None |
| project_usage | Members | None | None | None |
| rate_limits | None | None | None | None |

Note on profiles: co-members need names but not email addresses, except in group settings, which shows email addresses as in the design. Email is read from `auth.users` through a definer view that is limited to co-members.

**Activity log integrity**
- No INSERT, UPDATE or DELETE policy exists, and `authenticated` and `anon` also lose those table privileges. A BEFORE UPDATE OR DELETE trigger raises an exception.
- There is one exception. The account deletion foreign key action (`actor_id` set to null) is let through when it is the only change. Project or group deletion cascades the log, as the design's delete group dialog states.
- Entries are written by:
  - AFTER triggers on `tasks` (status change, assignment, create), `task_links` (insert) and `group_members` (join, leave, remove);
  - `review_task(task_id, kind, note)`, a definer RPC that checks membership, status `done`, reviewer not equal to assignee, and one review per completion;
  - `log_brief_uploaded(project_id)` and `log_tasks_created(project_id, count)`.
- Every one of these sets `actor_id := auth.uid()`. No function takes a user id parameter.

**Storage**
- There is one private bucket, `briefs`, with a 10 MB limit and allowed MIME type `application/pdf`.
- The object path is `{project_id}/{uuid}.pdf`. Storage RLS allows no direct client read or write.
- Uploads use a signed upload URL issued by the server after it checks membership and usage. Reads use signed URLs valid for 60 s, issued only to members.

**Automated proof (pgTAP, `supabase/tests/`)**
- Two users in two groups. For every table, user A cannot select, insert, update or delete group B's rows.
- The activity log rejects UPDATE and DELETE from everyone, including the group owner, and rejects direct INSERT.
- A forged `actor_id` is impossible, because no code path accepts one.
- Anonymous users read nothing.
- A member cannot promote themselves to owner, a non-owner cannot revoke invites, and a user cannot read another user's calendar feeds.
- Usage and rate limit tables cannot be written by clients.

The tests run in two places. Locally, they run against the Postgres 16 server in this container with a small `auth` schema shim. In GitHub Actions, they run against the real Supabase local stack through `supabase test db`.

## 5. Server routes (Hono, all JSON, all zod validated)

Authentication: every route except the public ones requires `Authorization: Bearer <supabase access token>`. The server verifies the token with Supabase and creates a Supabase client that acts **as the user**, so RLS still applies. The service role client is used only where noted.

| Method and path | Purpose | Guards |
|---|---|---|
| POST `/api/auth/magic-link` | Sends the sign in email. The server generates the link through the Supabase admin API and sends it through Resend with Nexa's own template. | Rate limits of 5 per hour per IP and 3 per hour per email. The request body is only `{ email, next }`, and `next` must be a same-origin path. |
| POST `/api/groups` | Creates a group, a project and the owner membership in one RPC | zod: name, module code, title, deadline (DD/MM/YYYY HH:MM, Europe/Dublin) |
| PATCH `/api/groups/:id`, member role, remove, leave, DELETE group | Group settings | Owner checks happen in RLS and triggers. The server never takes a role from the client for the acting user. |
| POST `/api/projects/:id/briefs/upload-url` | Returns a signed upload URL | Membership, usage remaining, size 10 MB or less declared |
| POST `/api/projects/:id/briefs/analyse` | Body is `{ storagePath }` or `{ text }` (max 60,000 characters). Checks the PDF signature, calls Haiku and stores `brief_analyses`. | Membership, AI rate limit (10 per hour per user, 30 per hour per IP), usage limit reserved atomically and released if the call fails |
| POST `/api/projects/:id/briefs/:analysisId/accept` | Saves the reviewed brief and the reviewed tasks | zod on the edited content. The client's edited version is saved, not the raw model output. |
| POST `/api/projects/:id/statements/generate` | Reads the log as the user, calls Sonnet and saves the statement | Membership, AI rate limit, usage limit |
| PATCH `/api/statements/:id` | Saves edited text | Membership through RLS |
| Tasks: POST, PATCH, links POST, reviews POST | Task board writes | Membership through RLS, zod. Status changes are logged by triggers. |
| POST `/api/projects/:id/invites` | Creates a link or email invite and sends the email through Resend | Owner only. Maximum 20 per day per group. |
| POST `/api/invites/:id/revoke` | Revokes an invite | Owner only |
| GET `/api/invites/:code/preview` | **Public.** Returns the project summary for the join page. | Rate limit of 30 per hour per IP. Returns only the group name, module, title, deadline, task count and hours, member first names and initials, and brief deliverables, deadlines and criteria. The brief text is never returned. |
| POST `/api/invites/:code/accept` | Joins the group | Authenticated. Rate limit of 10 per hour per user and 20 per hour per IP. Expiry, revocation, use count and member cap are checked atomically in one definer RPC. |
| GET `/api/projects/:id/calendar` | Returns the user's feed URL for display, creating it if none exists | Membership |
| POST `/api/projects/:id/calendar/regenerate`, POST `/api/calendar/:id/revoke` | Regenerates or revokes the feed | Own feed only |
| GET `/cal/:token.ics` | **Public** iCalendar feed. It contains only the titles and due dates of the user's tasks and the project's deadline items. No names, descriptions or links. | Token hash lookup, rate limit per token, `Cache-Control: private, max-age=900` |
| GET `/api/account/export` | Downloads a JSON file of all of the user's data | Self only, rate limit of 5 per day |
| POST `/api/account/delete` | Deletes the account (see section 8) | Body must be `{ confirm: "DELETE" }` |
| POST `/api/cron/reminders` | Hourly. Sends email for tasks due in 48 hours that have not been reminded. | `Authorization: Bearer CRON_SECRET`, called by `pg_cron` and `pg_net` from Supabase |
| POST `/api/cron/retention` | Daily. Sends deletion warning emails and deletes expired projects. | Same |

**Token design (invites and calendar feeds)**
- Each row stores a random 128-bit `nonce`.
- The token shown to the user is `base64url(HMAC-SHA256(SERVER_SECRET, nonce))`, truncated to 22 characters (132 bits).
- The database stores only `sha256(token)` for lookup.
- A database leak alone reveals no working token, but the server can still show a member their link again, as the design's invite and calendar screens require.
- Regenerating means a new nonce. Revoking means setting `revoked_at`.
- Invite links become about 22 characters long instead of the 8 in the design.

**AI safety**
- The system prompt states that the brief is untrusted data inside `<brief>` tags, that instructions inside it must be ignored, and that output must follow the schema only.
- Output is parsed by zod. Anything invalid is rejected with the design's error copy.
- The model has no tools, and its output is never executed.
- The output only fills a review form. Nothing is written to tasks until a member submits the reviewed form, and that submission is validated again.
- The statement prompt receives only the log for the one project, read under the user's RLS.
- For end to end tests an `AI_MOCK=1` switch returns fixtures, so CI never calls the API.

**Logging**
- A small logger allows only these fields: route, status, duration, request id, error code.
- It never logs bodies, email addresses, IP addresses, names or brief text.

## 6. Security controls outside routes

- **Headers (`vercel.json`):**
  - CSP: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://fauotybbzqlerctitcsc.supabase.co wss://fauotybbzqlerctitcsc.supabase.co; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`.
  - HSTS with 2 years, includeSubDomains and preload. `X-Content-Type-Options: nosniff`. `Referrer-Policy: strict-origin-when-cross-origin`, with `no-referrer` on `/join/*` and `/cal/*`.
  - `Permissions-Policy` disables camera, microphone, geolocation, payment and USB. `Cross-Origin-Opener-Policy: same-origin`.
- **Secret check:** `scripts/check-client-secrets.mjs` runs after `vite build`. It fails the build if `dist/` contains:
  - `sk-ant-` or `re_` key patterns;
  - a JWT whose payload has `"role":"service_role"`;
  - the names `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` or `RESEND_API_KEY`;
  - any `process.env` reference.

  Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are exposed to the client.
- **Content check:** `scripts/check-content.mjs` fails lint if UI strings or legal text contain emoji, em dashes or en dashes.
- **Dependencies:** `npm audit --audit-level=high` runs in CI. The lockfile is committed and major versions are pinned with `~` or exact versions.
- **CI (GitHub Actions):** type check, lint, content check, unit tests, pgTAP, build with the secret check, and Playwright.

## 7. Client structure

```
src/
  app/            router, auth provider, query client, layout shells (Sidebar, TopBar, SubNav, BottomNav)
  components/     Button, TextInput, Select, Textarea, Label, Badge, Avatar, FilterChip, Tabs,
                  SegmentedControl, Card, TaskCard, ProgressBar, Toast, InlineNotice, ErrorPanel,
                  EmptyState, Skeleton, Modal, BottomSheet, ConfirmDialog, QRCode, BarChart
  screens/        one folder per design screen (01 landing to 17 legal)
  lib/            supabase client, api client, date formatting (DD/MM/YYYY, 24 hour), realtime hooks
  styles/         tokens.css, fonts.css, base.css (focus ring, resets)
shared/schemas/   zod schemas used by client and server
server/           Hono app, routes, services (ai, email, tokens, ratelimit), logger
api/              Vercel entry points
supabase/         migrations/, tests/, seed.sql, config.toml
e2e/              Playwright specs
legal/            privacy.md, terms.md (marked DRAFT, rendered at /privacy and /terms)
```

- The layout follows the design's rules. Width is measured on the container: under 600 px is mobile, 600 to 1023 is tablet, and 1024 and up is desktop.
- On desktop there is a 248 px sidebar. On mobile and tablet there is a 56 px top bar, the project sub-nav and a 56 px bottom nav.
- Page padding is 16, 24 or 48 px, and content is at most 1200 px wide.
- Every screen implements the design's loading, error, empty and success states using the design's copy.
- Realtime subscribes to `postgres_changes` on `tasks` and `activity_log`, filtered by `project_id`. RLS applies to realtime, so a user only receives rows they could select.

## 8. Data protection

- **Minimisation:**
  - The only profile fields are name and email.
  - No analytics, and no cookies apart from the Supabase session.
  - The Supabase session lives in `localStorage`, which counts as strictly necessary.
  - The service worker caches only static assets.
  - The design's legal copy says "one essential cookie". I will correct it to the exact storage used.
- **Residency:**
  - Supabase: Ireland.
  - Vercel functions: Dublin. The CDN is global, and Vercel is covered by the EU-US Data Privacy Framework and SCCs.
  - Resend: EU region.
  - Anthropic processes in the US under its DPA with SCCs, and API data is not used for training.
  - The design's privacy text claims AI processing "within the European Economic Area". That is not accurate for the Anthropic API, and I will correct it.
- **Retention:** projects are deleted 30 days after `greatest(last_activity_at, final_deadline)`, with a warning email 7 days before. `last_activity_at` is updated by the same triggers that write the log. Rate limit rows are kept for 24 hours. Brief PDFs are deleted with their project.
- **Export:** an immediate JSON download containing the profile, memberships, assigned and created tasks, file links added, own log entries (including reviews), statements generated or edited, and calendar feed metadata. The design shows a ZIP with CSV emailed within 24 hours. I will change that copy to match the immediate JSON download.
- **Deletion:** immediate. In one server transaction:
  - ownership passes to the longest-standing member, and a group where the user is the only member is deleted;
  - the user's tasks become unassigned;
  - calendar feeds are deleted;
  - the auth user is deleted, which cascades the profile and memberships.

  Log entries stay with `actor_id` set to null and display "Former member", as in the design. The design says "within 30 days". I will change that to "immediately", with a note that Supabase backups can hold data for up to 7 days.

## 9. Build order and commits

Each milestone ends with a type check, lint, the relevant tests and a commit pushed to `claude/intelligent-cannon-rh2f0i`.

1. **Scaffold and schema:** move the design folder; set up Vite, TypeScript, ESLint, Vitest, tokens and fonts; write all migrations with RLS; add pgTAP RLS tests; apply the migrations to Supabase with the MCP connector; add the secret and content checks; add CI.
2. **Auth:** add the magic link route with rate limits, Google sign in, the sign in screens, route guards, the profile trigger and the Vercel project with its first deployment.
3. **Groups and invites:** create group, dashboard, group settings, invite create, revoke and email, the public join page, accept, and QR code.
4. **Task board with realtime:** board columns and tabs, task detail, status control, file links, filters and the realtime hooks.
5. **Brief breakdown:** signed upload, PDF signature check, the Haiku call with schema, the processing state, the review screen, the proposal screen with a client-side "Suggest a new split" (no AI call), and accept.
6. **Usage limits:** plan limits, atomic reservation, and display in the interface.
7. **Contribution log and statement:** log timeline and summary with BarChart, confirm and flag, the Sonnet statement, editing, PDF and plain text export.
8. **Email:** Resend templates for sign in, invite, 48 hour reminder and retention warning; `pg_cron` jobs.
9. **Calendar feed:** token routes, the `.ics` generator (RFC 5545, with a unit test), the modal and bottom sheet, and revoke and regenerate from account settings.
10. **Account:** export and delete.
11. **Legal pages:** privacy and terms marked DRAFT, with the design's layout, a table of contents on desktop and footer and sign up links.
12. **PWA:** manifest, service worker (shell only), icons as plain text marks since the design has no logo, and install tests.
13. **End to end and README:** Playwright tests for sign up, invite join, brief upload and task completion at 375 and 1280 px, then README.md and SECURITY.md.

## 10. Where I will deviate from the design, and why

| Design | Plan | Reason |
|---|---|---|
| Fonts from Google Fonts | Self hosted, same files | GDPR and CSP |
| 8-character invite code | 22-character code | The requirement is at least 128 bits |
| Data export as ZIP by email within 24 hours | Immediate JSON download | Feature 11 as specified |
| Account deleted within 30 days | Deleted immediately | Feature 11 and minimisation |
| Privacy text: AI in the EEA, retention 12 months after deadline, one cookie | Corrected to the actual processors, retention and storage | The text must be accurate |
| No usage limit display | An InlineNotice (Mist) on the brief and statement screens, for example "Brief breakdowns used: 2 of 5" | Feature 9 requires it to be shown. It uses only existing components. |
| "Open the link (prototype)" button | Removed | Prototype only |
| Title "Terms of use" | Kept as "Terms of use" at `/terms` | Matches the design. It covers everything the Terms of Service need. |

## 11. Decisions (confirmed 26/09/2026)

1. Retention: a project is deleted 30 days after its last activity or 30 days after its final deadline, whichever is later. A warning email goes to all members 7 days before deletion, with a link to keep the project, which counts as activity.
2. Invites: owners only.
3. Student number: dropped. Profiles hold name and email only.
4. Usage display: InlineNotice wording approved, for example "Brief breakdowns used: 2 of 5".
5. Domain: the Vercel URL for now, read from `APP_URL`. A custom domain and the Resend sending domain follow after the build.

## 12. Changes made during the build

- **Name step.** A sign in link carries no name, so new accounts enter their name once on a short screen after the first sign in. Members see it on the board, in the log and in statements.
- **New task.** The prototype creates a task called "New task" and opens it. The app opens a New task form instead (modal from 600 px, bottom sheet below), so no placeholder entries reach the log.
- **Calendar link.** The feed URL is shown as `https://…/cal/<token>.ics`, which Google, Apple and Outlook all accept, instead of the prototype's `webcal://`.
- **Scheduled jobs.** Vercel Hobby cron runs only daily, so hourly reminders and the daily retention job run in Supabase pg_cron and call the API through pg_net, with the URL and secret in Supabase Vault.
- **Sign in email.** Sign in links are generated with the Supabase admin API and sent through Resend, so Nexa controls per IP and per email rate limits and the email wording.
- **Tests.** RLS tests use pgTAP and run both on a plain Postgres with a small Supabase shim (`npm run test:db`) and on the real Supabase stack (`npx supabase test db`). Accessibility is checked with axe-core in Playwright.
- **Statement drafting** sends members' names and the log digest to the AI model (no email addresses or file links). This is stated in the app and the privacy policy.
- **Usage display** appears on the brief and statement screens as an inline notice, as agreed.
