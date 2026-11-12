# Nexa

Nexa helps university student groups coordinate group assignments. A member uploads the assignment brief, Nexa extracts the deliverables, deadlines, word counts and marking criteria and proposes tasks with an even split of hours. The group works on a shared task board, every completion, file link, confirmation and flag is recorded in an append only contribution log, and at the end the group exports a contribution statement.

- Responsive web app for mobile and desktop, installable as a PWA.
- Design: `design/` (Claude Design export). Tokens and components are mapped into `src/styles/tokens.css` and `src/components/`.
- Plan and decisions: `PLAN.md`. Security: `SECURITY.md`. Legal drafts: `legal/`.

## Stack

| Part | Technology |
|---|---|
| Client | React 19, TypeScript, Vite, React Router, TanStack Query |
| Server | Hono on Vercel Node.js functions (`api/index.ts`, `api/ai.ts`), region Dublin (`dub1`) |
| Data | Supabase (project `nexa`, `eu-west-1`): Postgres with RLS, Auth, Realtime, Storage, pg_cron |
| AI | Claude API: `claude-haiku-4-5` reads briefs, `claude-sonnet-5` drafts statements |
| Email | Resend |
| Tests | Vitest, pgTAP, Playwright with axe-core |

## Repository layout

```
api/                 Vercel function entry points (one Hono app)
server/              API routes, services (AI, email, storage), rate limits, tokens, logger
shared/              zod schemas, date helpers, iCalendar builder, database types
src/                 React app: components, screens, app shell, client libraries
supabase/            config.toml, migrations, pgTAP tests
e2e/                 Playwright tests (375 and 1280 px)
legal/               Privacy policy and terms of use (drafts)
scripts/             Build checks, local database tests, local environment writer
design/              Claude Design export (reference only)
```

## Local development

Requirements: Node.js 22, Docker (for the local Supabase stack).

```bash
npm ci
npx supabase start          # local Postgres, Auth, Storage, Realtime; applies all migrations
node scripts/local-env.mjs  # writes .env.local from `supabase status` (local keys only)
npm run dev:api             # API on http://localhost:8787
npm run dev                 # app on http://localhost:5173 (proxies /api and /cal)
```

`.env.local` sets `NEXA_TEST_MODE=1` with `EMAIL_MOCK=1` and `AI_MOCK=1`, so no email is sent and no AI call is made. Sign in links are available at `http://localhost:8787/api/test/outbox`. The test helpers only work with `NEXA_TEST_MODE=1` and never on Vercel or Replit, and the API refuses to start on a hosted platform where any of these settings is switched on. To try the real Claude API locally, set `AI_MOCK=0` and add `ANTHROPIC_API_KEY` to `.env.local`.

If your Docker setup cannot reach `public.ecr.aws`, start the stack with `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `npm run dev:api` | Client and API in development |
| `npm run build` | Type check, production build, client secret check, PWA check |
| `npm run typecheck` | TypeScript for client, server and tests |
| `npm run lint` | ESLint plus the content check (no emoji, em dashes or en dashes) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | pgTAP tests on a throwaway local Postgres (needs Postgres and pgTAP installed) |
| `npx supabase test db` | The same pgTAP tests against the local Supabase stack |
| `npm run test:e2e` | Playwright end to end and accessibility tests at 375 and 1280 px (needs the local stack and `.env.local`) |
| `SCREENSHOTS=1 npx playwright test e2e/screens.spec.ts` | Screenshots at 375, 768 and 1280 px, fails on horizontal scrolling |
| `npm run audit` | `npm audit --audit-level=high` |

CI (`.github/workflows/ci.yml`) runs audit, type check, lint, unit tests and build, then starts the local Supabase stack and runs pgTAP and Playwright.

## Environment variables

Set these in Vercel (Project settings, Environment Variables) for Production and Preview. Values marked secret must never be given a `VITE_` prefix.

| Variable | Secret | Value | Where it comes from |
|---|---|---|---|
| `VITE_SUPABASE_URL` | No | `https://fauotybbzqlerctitcsc.supabase.co` | Already set in Vercel |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | No | `sb_publishable_...` | Already set in Vercel |
| `SUPABASE_URL` | No | Same as `VITE_SUPABASE_URL` | Already set in Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Secret key (`sb_secret_...`) or legacy service_role key | Supabase dashboard, Project settings, API Keys |
| `ANTHROPIC_API_KEY` | **Yes** | `sk-ant-...` | console.anthropic.com, API Keys. Set a monthly spend limit. |
| `RESEND_API_KEY` | **Yes** | `re_...` | resend.com, API Keys (sending access only) |
| `EMAIL_FROM` | No | `Nexa <noreply@your-domain>` | A sender on your verified Resend domain |
| `APP_URL` | No | `https://<your-project>.vercel.app`, later your domain | The production URL, no trailing slash |
| `TOKEN_SECRET` | **Yes** | 48 random bytes, base64 | `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `CRON_SECRET` | **Yes** | 32 random bytes, base64url | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `STRIPE_SECRET_KEY` | **Yes** | `sk_test_...` until launch, then `sk_live_...` (or a restricted `rk_` key) | dashboard.stripe.com, Developers, API keys |
| `STRIPE_WEBHOOK_SECRET` | **Yes** | `whsec_...` | dashboard.stripe.com, Developers, Webhooks, the endpoint `<APP_URL>/api/stripe/webhook` |
| `STRIPE_PRICE_PROJECT` | No | `price_...` | The 2 euro one off price of the product "Project unlock" |
| `STRIPE_PRICE_SUBSCRIPTION` | No | `price_...` | The 7.99 euro monthly recurring price of the product "Monthly plan" |

Only for local development and tests: `NEXA_TEST_MODE`, `AI_MOCK`, `EMAIL_MOCK`, `RATE_LIMIT_MULTIPLIER`, `API_PORT`. Never set the first four in Vercel: the API refuses to start on a deployment that has any of them switched on.

Rotating `TOKEN_SECRET` invalidates all invite and calendar links.

### Stripe

Payments use Stripe Checkout and the Stripe Customer Portal; card details never reach Nexa. The webhook endpoint `<APP_URL>/api/stripe/webhook` must send these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`. Every request is checked against `STRIPE_WEBHOOK_SECRET`; each event id is applied once (`stripe_events`) and each Checkout session once (`billing_purchases`). Subscription changes are read back from Stripe, so events that arrive out of order cannot roll the state back. Plan limits are enforced in the database (`supabase/migrations/20261112110000_plans_and_billing.sql`).

## Deployment

1. **Database.** Apply the migrations in `supabase/migrations/` to the Supabase project `nexa` (`eu-west-1`). The launch hardening migration (`20261101120000`) must be applied before the matching API code is deployed, because the sign in route writes to its `signup_allowances` table. For changes: `npx supabase link --project-ref fauotybbzqlerctitcsc` then `npx supabase db push`, or apply them with the Supabase connector. Keep every change as a migration file.
2. **Vercel project.** The project `nexa` exists in your Vercel account with the public variables set. Install the Vercel GitHub app for `klassenjona4/Nexa` (github.com/apps/vercel), then connect the repository under Project settings, Git. Set the production branch (for example `main`).
3. **Secrets.** Add the secret variables from the table above in Vercel.
4. **Deploy.** Push to the production branch or redeploy in Vercel. `vercel.json` sets the build, the Dublin function region, rewrites and the security headers.
5. **Scheduled jobs.** In the Supabase SQL editor, store the API URL and the cron secret in Vault (use the same `CRON_SECRET` as in Vercel):

   ```sql
   select vault.create_secret('https://<your-app-url>', 'nexa_app_url');
   select vault.create_secret('<CRON_SECRET>', 'nexa_cron_secret');
   ```

   pg_cron then calls `/api/cron/reminders` hourly and `/api/cron/retention` daily. Until both secrets exist the jobs do nothing.
6. **Check.** Open `/api/health`, sign in, create a group, upload a brief and check the security headers (for example with securityheaders.com).

## What you must configure by hand

**Supabase dashboard (Authentication)**

- URL Configuration: set Site URL to your `APP_URL`. Add redirect URLs `https://<your-app-url>/**` and `http://localhost:5173/**`.
- Email provider: set the email OTP expiry to 900 seconds (15 minutes, as stated in the app and the terms). Sign in emails are sent by Nexa through Resend, so Supabase's own email templates are not used.
- Keep Supabase's built in email sender and its low email rate limit, or set strict rate limits if you add custom SMTP (see `SECURITY.md`).
- Hooks: add a Before User Created hook of type Postgres function, `public.hook_before_user_created`. It refuses email sign ups that do not come through Nexa's sign in route, so nobody can create an account with a password for someone else's address. Apply the launch hardening migration first.
- Passwords (Attack Protection): turn on leaked password protection if your plan includes it and set the minimum password length to 12. Nexa never uses passwords, but Supabase Auth accepts them.
- Google provider: enable it and paste the Google client ID and secret (below).
- Delete the paused project "klassenjona4's Project TEST" if you no longer need it (Project settings, General).

**Google OAuth (Google Cloud Console)**

1. Create a project, configure the OAuth consent screen (external, app name Nexa, your support email, links to `/privacy` and `/terms`, scopes `openid`, `email`, `profile`).
2. Create an OAuth client ID of type Web application. Authorised redirect URI: `https://fauotybbzqlerctitcsc.supabase.co/auth/v1/callback`.
3. Enter the client ID and secret in Supabase, Authentication, Providers, Google.

**Resend**

1. Add and verify your sending domain (DNS records at your registrar). Choose the EU region (`eu-west-1`) for the domain.
2. Create an API key with sending access and set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel.

**Anthropic**

Create an API key, set a monthly spend limit, and set `ANTHROPIC_API_KEY` in Vercel. Review Anthropic's commercial terms and data processing addendum for the privacy policy.

Nexa also stops all AI requests for the day after 500 across all projects. Change the ceiling in the Supabase SQL editor: `update public.service_limits set max_value = 300 where name = 'ai_requests_per_day';`

**Legal**

Complete `[ADDRESS]` in `legal/terms.md`, have both documents reviewed by a legal professional, then change `status: draft` to `status: final`. The pages then show "Last updated" instead of the draft label.

**Custom domain (later)**

Add it in Vercel, update `APP_URL`, the Supabase Site URL and redirect URLs, the Vault secret `nexa_app_url`, and the Resend sender.

## Accessibility

Target: WCAG 2.1 AA. Automated axe-core checks run on every screen at 375 and 1280 px (`e2e/a11y.spec.ts`). Built in: visible labels, `Error:` prefixes on field errors, focus ring in Slate, skip link, focus trap and Escape in dialogs, status written as text, 44 px minimum touch targets, text sized in rem. Manual checks before launch: keyboard only walkthrough, a screen reader pass (VoiceOver, NVDA), and 200 % zoom.

## Content rules

Plain factual copy in Irish English, dates as DD/MM/YYYY, 24 hour time, no emoji, no em or en dashes, no marketing language. `npm run lint` enforces the character rules on UI, email and legal text.

## Privacy by design

No cookies, no analytics, session in local storage only, service worker caches the app shell only, minimal profile, immediate account deletion, JSON export, automatic project deletion 30 days after the last activity or the final deadline (whichever is later) with a warning 7 days before. See `legal/privacy.md`.
