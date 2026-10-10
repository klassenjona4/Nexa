# Security

## Reporting a vulnerability

Email **[CONTACT EMAIL]** with a description, the steps to reproduce and the impact. Please do not open a public issue and do not access, change or delete other people's data while testing.

You will receive a reply within 5 working days. Confirmed issues are fixed as quickly as possible and you are told when the fix is released. Please allow 90 days before public disclosure. Good faith research that follows these rules will not lead to legal action.

## Threat model

**What is protected**

- Group data: briefs, tasks, file links, the contribution log and statements. Students rely on the log for peer assessment, so its integrity matters as much as its confidentiality.
- Personal data: names, email addresses and membership of groups.
- Secrets: the Supabase service role key, the Claude API key, the Resend key, `TOKEN_SECRET` and `CRON_SECRET`.
- The operator's AI budget.

**Who might attack**

- A signed in student who tries to read or change another group's data.
- A group member who tries to rewrite the contribution log, impersonate a teammate, promote themselves or bypass usage limits.
- Anyone on the internet who guesses invite codes or calendar tokens, abuses sign in emails, or runs up AI costs.
- Content inside an uploaded brief or in log text that tries to instruct the AI model (prompt injection).
- A compromised browser extension or injected script that tries to read the session (XSS).

**Entry points**

The React client, the Supabase REST, Realtime and Storage APIs (reached with the publishable key and the user's session), the Nexa API on Vercel (`/api/*`), the public calendar feed (`/cal/*`), the public invite preview, and the scheduled job endpoints.

## Controls

| Area | Control | Where |
|---|---|---|
| Authorisation | RLS is enabled and forced on every table. Anonymous users have no table privileges. Signed in users get only the listed table and column privileges, and every policy checks group membership through `private.is_group_member` or similar helpers. | `supabase/migrations/*_rls_policies.sql` |
| Proof | pgTAP tests show that a user cannot read, insert, update or delete another group's data in any table, that anonymous users read nothing, and that server-only functions are not callable by clients. They run locally and in CI against the Supabase image. | `supabase/tests/database/` |
| Log integrity | The activity log has no insert, update or delete policy, and clients have no write privilege on it. A trigger rejects updates, deletes and truncation even from privileged roles, except the foreign key cascade that removes a deleted account's identity. Entries are written only by triggers and database functions that take the actor from `auth.uid()`, never from a parameter. | `*_functions_triggers.sql` |
| Roles | Roles, usage counts, plans, completion counters and authorship are not writable by clients (column grants plus triggers). A group always keeps at least one owner and at most 8 members. | migrations, tests |
| Server input | Every API route validates input with zod (strict objects, lengths, formats) and runs database writes as the user, so RLS still applies. The service role client is used only for server-only tables after an explicit check. | `server/routes/`, `shared/schemas/` |
| Secrets | Server secrets exist only as Vercel environment variables. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` reach the browser. ESLint forbids `process.env` and server imports in client code, and the build fails if a key pattern, a service role JWT or a secret variable name appears in `dist/`. | `scripts/check-client-secrets.mjs` |
| Rate limits | Per IP and per email for sign in links; per user and per IP for AI routes, invite previews and invite joins; per token for calendar feeds; per group for invite creation. Buckets are keyed hashes, so no IP address is stored. | `server/ratelimit.ts` |
| AI cost | Usage per project is reserved atomically in the database before each AI call and released if the call fails. Limits come from `plan_limits`. | `reserve_usage` |
| Uploads | PDF only, checked by file signature on the server, 10 MB limit enforced by the bucket and the server, private bucket without storage policies, uploads through server issued signed URLs, reads through 60 second signed URLs for members only. Files are removed when their project is deleted. | `server/routes/briefs.ts` |
| Prompt injection | Briefs and log text are passed only as data. System prompts tell the model to ignore instructions inside them. The model has no tools. Output is structured, validated with zod twice, cleaned, and only fills a form that a member reviews. It cannot trigger actions, change permissions or reach other groups' data, because all writes run under the member's RLS. | `server/services/ai.ts` |
| Tokens | Invite codes and calendar tokens are `HMAC-SHA256(TOKEN_SECRET, purpose + 128 bit random nonce)`, 22 base64url characters (132 bits). Only `sha256(token)` is stored. Invites expire after 7 days, have a maximum use count and can be revoked (revocation is one way). | `server/tokens.ts` |
| Headers | Strict CSP without inline scripts or styles, `frame-ancestors 'none'`, HSTS, `X-Content-Type-Options`, `Referrer-Policy` (no referrer on join and calendar links), `Permissions-Policy`, COOP and CORP. | `vercel.json` |
| Scheduled jobs | Called by Supabase pg_cron with a shared secret stored in Supabase Vault and compared in constant time. | `server/routes/cron.ts` |
| Logging | Logs carry an allow list of fields only (event, route template, status, duration, request id, error code). Paths are logged as templates without ids or tokens. No bodies, names, emails, IP addresses or brief content are logged. | `server/logger.ts` |
| Dependencies | Exact versions, committed lockfile, `npm audit --audit-level=high` in CI. | `.npmrc`, CI |
| Data protection | Minimal profile (name only), immediate account deletion, JSON export, automatic project deletion, no analytics, no cookies. | `PLAN.md`, privacy policy |

## Residual risks and notes

- **Signed in functions.** Seven `security definer` functions are callable by signed in users (`create_group_with_project`, `create_project`, `review_task`, `leave_group`, `keep_project`, `group_member_list`, `export_my_data`). Each checks `auth.uid()` and membership itself. The Supabase advisor lists them as warnings, which is expected.
- **Direct Supabase sign in.** A client could call Supabase's own `signInWithOtp` with the publishable key and bypass Nexa's sign in rate limits. Keep Supabase's built in email sender (it only delivers to project team members) or keep its email rate limit low. Do not configure custom SMTP in Supabase unless its rate limits are set.
- **Client IP.** Per IP limits use `x-real-ip`, which Vercel sets. Outside Vercel the header can be spoofed.
- **Session storage.** The Supabase session is kept in `localStorage`. The strict CSP is the main defence against script injection; React escapes all rendered text and no HTML from users or the AI is rendered.
- **Invite preview.** Anyone holding a valid invite link sees the group name, project details, members' first names and the extracted brief. This is intended; owners can revoke links.
- **Rotation.** Rotating `TOKEN_SECRET` invalidates every invite link and calendar link at once.
- **AI output.** Output may be wrong or biased. It is always presented as a draft for members to check.
