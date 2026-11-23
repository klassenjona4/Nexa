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

`nexa-groups.vercel.app` still serves the app, so old links keep working. Redirect it to `nexa-groups.com` once sign in works on the new domain (step 10 below).

## To do by hand (dashboards only the owner can reach)

| # | Step | Where |
|---|---|---|
| 8 | Site URL `https://nexa-groups.com`; add redirect URL `https://nexa-groups.com/**`; keep `https://nexa-groups.vercel.app/**` and `http://localhost:5173/**` | Supabase, Authentication, URL Configuration |
| 9 | Add `nexa-groups.com` to Authorised domains; update home page, privacy and terms links | Google Cloud Console, OAuth consent screen (Branding) |
| 10 | After testing sign in: edit `nexa-groups.vercel.app`, Redirect to `nexa-groups.com`, 308 | Vercel, project nexa, Settings, Domains |
| 11 | Add domain `nexa-groups.com`, region EU (eu-west-1); send the records to Claude or add them in Vercel DNS; click Verify | resend.com, Domains |
| 12 | Set `EMAIL_FROM` to `Nexa <noreply@nexa-groups.com>`, then redeploy | Vercel, Environment Variables |
| 13 | Create an account, add domain `nexa-groups.com`, alias `hello` forwarding to the personal inbox | improvmx.com |
| 14 | Optional: Gmail, Settings, Accounts, Send mail as `hello@nexa-groups.com`; SMTP `smtp.resend.com`, port 465, user `resend`, password a Resend API key | Gmail |

## DNS records for email

Added in Vercel DNS for `nexa-groups.com`.

| Purpose | Type | Name | Value | Priority |
|---|---|---|---|---|
| Receiving (ImprovMX) | MX | `@` | `mx1.improvmx.com` | 10 |
| Receiving (ImprovMX) | MX | `@` | `mx2.improvmx.com` | 20 |
| Receiving SPF (ImprovMX) | TXT | `@` | `v=spf1 include:spf.improvmx.com ~all` | |
| DMARC | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@nexa-groups.com` | |
| Sending (Resend) | as shown by Resend | `send`, `resend._domainkey` | DKIM key and SPF for the `send` subdomain | |

Resend sends from the `send` subdomain, so its SPF record does not clash with the ImprovMX record on the root.

## Checks after setup

1. `https://nexa-groups.com/api/health` returns ok.
2. `https://www.nexa-groups.com` redirects to `https://nexa-groups.com`.
3. Sign in with an email code on a phone; the email comes from `noreply@nexa-groups.com` and does not land in spam.
4. Sign in with Google.
5. Create a group, invite a second address, open the invite link.
6. An email to `hello@nexa-groups.com` arrives in the personal inbox.
7. securityheaders.com shows grade A for `https://nexa-groups.com`.
