# Domain and email setup log

Domain: `nexa-groups.com`, registered 23/11/2026 through Vercel (team `klassenjona4`), registrant Jona Klassen (private person). Nameservers: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`, so every DNS record is managed in Vercel, Domains, nexa-groups.com.

## Done

| # | Step | Where | Result |
|---|---|---|---|
| 1 | Bought `nexa-groups.com` (USD 12.03 per year, auto renew on) | Vercel, Domains | Registered, Vercel nameservers |
| 2 | Added `nexa-groups.com` to project `nexa` as production domain | Vercel, project nexa, Settings, Domains | Verified, HTTPS certificate automatic |
| 3 | Added `www.nexa-groups.com` with a 308 redirect to `nexa-groups.com` | Same | Verified |
| 4 | Changed `APP_URL` from `https://nexa-groups.vercel.app` to `https://nexa-groups.com` | Vercel, Environment Variables (Production) | Used for links in emails, invites and calendar feeds |
| 5 | Changed Vault secret `nexa_app_url` to `https://nexa-groups.com` | Supabase SQL: `vault.update_secret` | pg_cron reminder and retention jobs call the new address |
| 6 | Redeployed production so the new `APP_URL` is used | Vercel, Deployments | New production deployment |
| 7 | Contact address in privacy policy, terms and `security.txt` changed to `hello@nexa-groups.com`; `security.txt` canonical URL moved to the new domain | Repository | Goes live with the next merge to `main` |
| 8 | Supabase Site URL and redirect URLs, Google OAuth authorised domain, Resend domain (EU, records added automatically by Resend), ImprovMX alias `hello` | Dashboards (owner) | Done and tested by the owner |
| 9 | `EMAIL_FROM` changed from the Resend test sender `onboarding@resend.dev` (which only delivers to the Resend account owner) to `Nexa <noreply@nexa-groups.com>`; production redeployed | Vercel | Sign in and invite emails reach every user |
| 10 | Checked `https://nexa-groups.com/api/health`: 200 `{"ok":true}`, region `dub1`, all security headers present | | Passed |

`nexa-groups.vercel.app` still serves the app, so old links keep working. Sign in works on the new domain, so it can now redirect to `nexa-groups.com` (step 11 below).

## To do by hand (dashboards only the owner can reach)

| # | Step | Where |
|---|---|---|
| 11 | Edit `nexa-groups.vercel.app` and `nexa-seven-zeta.vercel.app`: Redirect to `nexa-groups.com`, 308 | Vercel, project nexa, Settings, Domains |
| 12 | Merge branch `claude/wizardly-sagan-hk1v0b` into `main` (contact address and this log) | GitHub |
| 13 | Optional: Gmail, Settings, Accounts, Send mail as `hello@nexa-groups.com`; SMTP `smtp.resend.com`, port 465, user `resend`, password a Resend API key | Gmail |

## DNS records for email

Added in Vercel DNS for `nexa-groups.com`.

| Purpose | Type | Name | Value | Priority |
|---|---|---|---|---|
| Receiving (ImprovMX) | MX | `@` | `mx1.improvmx.com` | 10 |
| Receiving (ImprovMX) | MX | `@` | `mx2.improvmx.com` | 20 |
| Receiving SPF (ImprovMX) | TXT | `@` | `v=spf1 include:spf.improvmx.com ~all` | |
| DMARC | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@nexa-groups.com` | |
| Sending DKIM (Resend) | TXT | `resend._domainkey` | public DKIM key | |
| Sending (Resend, EU) | CNAME | `send` | `send.forge.rmta.net` | |
| Sending (Resend, EU) | CNAME | `rsend` | `rsend-euw1.forge.rmta.net` | |

Resend uses the `send` subdomain as its return path, so its SPF does not clash with the ImprovMX SPF record on the root.

## Checks after setup

1. `https://nexa-groups.com/api/health` returns ok.
2. `https://www.nexa-groups.com` redirects to `https://nexa-groups.com`.
3. Sign in with an email code on a phone; the email comes from `noreply@nexa-groups.com` and does not land in spam.
4. Sign in with Google.
5. Create a group, invite a second address, open the invite link.
6. An email to `hello@nexa-groups.com` arrives in the personal inbox.
7. securityheaders.com shows grade A for `https://nexa-groups.com`.
