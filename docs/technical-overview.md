# Nexa: technical overview and judge Q&A

Status 23/11/2026. Live at https://nexa-groups.com. Built by Jona Klassen.

## 1. Nexa in one paragraph

Nexa is a web app for university group assignments. A member uploads the assignment brief; AI extracts the deliverables, deadlines, word counts and marking criteria and proposes a fair task split. The group works on a shared real-time task board. Every completion, file link, peer confirmation and flag goes into a contribution log that nobody can edit or delete, not even the group owner. At the end the group exports a contribution statement as a PDF for the lecturer.

## 2. Architecture at a glance

```
 Phone / laptop browser (installable PWA)
        |  HTTPS, strict security headers
        v
 Vercel (CDN + Node functions in Dublin, dub1)  <-- domain nexa-groups.com
   - React app (static files)
   - Nexa API (Hono): sign in, groups, invites, briefs, statements, account, cron
        |                         |                  |               |
        v                         v                  v               v
 Supabase (Ireland, eu-west-1)   Claude API        Resend (EU)     Stripe (switched off)
   Postgres + Row Level Security  (brief reading,   (sign in,       (2 euro project unlock,
   Auth (email link, Google)       statements,       invites,         7.99 euro / month)
   Realtime, Storage (PDFs)        help chat)        reminders)
   pg_cron jobs -> call the API hourly and daily
```

Data lives in Ireland. The browser talks to Supabase directly for reading data (protected by Row Level Security) and to the Nexa API for anything that needs a secret: AI calls, emails, invite tokens, uploads, payments.

## 3. What is used for what, and why

| Part | Technology | What it does in Nexa | Why this choice |
|---|---|---|---|
| Domain and DNS | nexa-groups.com, registered and hosted on Vercel | Address of the app, DNS for email | One place for hosting and DNS; HTTPS automatic |
| Front end | React 19, TypeScript, Vite, React Router, TanStack Query | All screens, offline-capable shell, live updates | Industry standard, type safe, fast builds; TanStack Query handles caching, retries and loading/error states |
| Styling | CSS Modules and design tokens, self-hosted fonts | Own design system, no UI library | Fonts from Google would send every visitor's IP to Google (GDPR); own components match the design exactly |
| PWA | vite-plugin-pwa (Workbox) | Add to home screen, app-like on phones | Students live on their phones; no app store needed |
| API | Hono on Vercel Node.js functions, region Dublin | Every action that needs a secret or a check | Small and fast; one router fits the free plan's function limit; Dublin keeps data close to the database |
| Validation | zod schemas shared by client and server | Every input is checked on the server | One definition, used twice: no mismatch between form and API |
| Database | Supabase Postgres 17 (Ireland) | Groups, projects, tasks, log, statements, invites | Real relational database with Row Level Security; EU data residency |
| Authorisation | Row Level Security on every table, 13 migrations | A student can only see their own groups, enforced inside the database | Even a bug in the app or a direct API call cannot leak another group's data |
| Contribution log | Append-only table written only by database triggers | The fair record of who did what | No insert, update or delete permission for anyone; the actor is always taken from the login, never from the request |
| Sign in | Supabase Auth: passwordless email link (sent by Nexa through Resend) and Google | No passwords to leak or forget | A sign-up hook blocks accounts created around Nexa's rate limits |
| Real time | Supabase Realtime | Board updates instantly for every member | Respects Row Level Security, so nobody receives other groups' changes |
| File storage | Supabase Storage, private bucket | Assignment brief PDFs | PDF only, 10 MB, checked by file signature, 60 second signed links, deleted with the project |
| AI: brief reading | Claude Haiku 4.5 (Anthropic) | Turns a brief into deliverables, deadlines, criteria and a task split | Fast and cheap for structured extraction |
| AI: statements | Claude Sonnet 5 | Drafts the contribution statement from the log | Better writing quality for the document a lecturer reads |
| AI: help chat | Claude Haiku 5.5 | Answers "how do I" questions from the help page | Cheap, answers only from Nexa's own help text |
| Email sending | Resend, EU region, from noreply@nexa-groups.com | Sign in links, invites, 48 hour reminders, deletion warnings | Developer-friendly, EU region, DKIM signed so it does not land in spam |
| Email receiving | ImprovMX forwarding, hello@nexa-groups.com | Contact and privacy address | Free; forwards to the founder's inbox |
| Scheduled jobs | Supabase pg_cron plus pg_net, secret in Supabase Vault | Hourly deadline reminders, daily data retention | Vercel's free cron only runs daily |
| PDF export | pdf-lib in the browser | Contribution statement as PDF | No server cost; nothing leaves the device |
| Payments | Stripe Checkout and Customer Portal (built, switched off) | 2 euro one-off project unlock, 7.99 euro per month plan | Card data never touches Nexa; off until the business is registered |
| Tests | Vitest (14 unit test files), pgTAP (6 database security test files), Playwright (8 end-to-end specs) with axe-core | Every change is checked automatically in GitHub Actions | The database tests prove one group cannot read or change another group's data |
| Accessibility | WCAG 2.1 AA target, automated axe checks at phone and desktop widths | Usable with screen readers and keyboard | Universities must buy accessible software |
| Code | About 9,600 lines of TypeScript, GitHub, CI on every change | | |

## 4. Security and privacy in plain words

- **Data stays in the EU.** Database and storage in Ireland, API in Dublin, email in the EU. The only exception is the AI step: Anthropic processes the brief text in the US under standard contractual clauses and does not train on API data. This is stated in the privacy policy.
- **Isolation is enforced by the database,** not just by the app. Automated tests attempt every read and write across groups and must fail.
- **The log cannot be rewritten.** Not by members, not by the owner, not by the app. That is what makes the contribution record trustworthy.
- **Peer review cannot be gamed.** You cannot confirm your own task, and the person who marked a task done cannot confirm it either.
- **Secrets never reach the browser.** The build fails if an API key pattern appears in the shipped files.
- **Strict security headers.** Content Security Policy without inline scripts, HSTS, no framing. Checked live on 23/11/2026.
- **Minimal data.** Name and email only. No analytics, no tracking cookies. Account deletion is immediate; data export is one click (JSON). Projects are deleted automatically 30 days after the last activity or the final deadline, with a warning 7 days before.
- **AI is contained.** The brief is treated as untrusted data, the model has no tools, its output is validated and only fills a form that a human reviews. A daily ceiling of 500 AI requests caps the cost.
- **Abuse limits.** Rate limits on sign in, invites and AI; quotas in the database (8 members per group, 300 tasks per project).

## 5. Running costs today

| Item | Cost |
|---|---|
| Domain nexa-groups.com | USD 12 per year |
| Vercel (Hobby) | 0 |
| Supabase (Free) | 0 |
| Resend | 0 up to 3,000 emails a month |
| ImprovMX | 0 |
| Claude API | Pay per use, a few cents per brief, capped at 500 requests a day |

**Total: about 1 euro a month plus AI usage.** Before charging customers: Vercel Pro (USD 20 a month, Hobby is non-commercial only), and later Supabase Pro (USD 25 a month, no pausing, daily backups).

## 6. Prepared answers

Answer in one or two sentences, then stop. Offer detail only if they ask.

### Product

**Why would students use this instead of WhatsApp?**
WhatsApp is for talking; it does not know what the assignment requires, who owns which task, or who actually did the work. Nexa reads the brief for you, splits the work fairly and keeps a record that protects the person who did the work. Groups can keep WhatsApp for chat.

**What makes it different from Trello, Notion or Microsoft Planner?**
Those are general tools that someone has to set up. Nexa is built for one job: it reads the assignment brief, proposes the tasks, and produces a contribution record a lecturer can trust, because nobody can edit it afterwards.

**How does the AI work, and what if it is wrong?**
It reads the brief and proposes deliverables, deadlines and a task split. Everything is a draft: the group reviews and edits it before anything is saved. The AI never acts on its own.

**Can the contribution log be faked?**
Members cannot edit or delete log entries, not even the group owner; the database itself refuses. Teammates confirm or flag completed work, and you cannot confirm your own task.

**What does the lecturer see?**
Today, the contribution statement the group exports as a PDF. Next semester: a lecturer dashboard with contribution reports across all groups in a module.

**Does it work on phones?**
Yes. It is a responsive web app that installs to the home screen, tested at phone and desktop sizes. Scan the QR code and try it.

### Technology

**Did you build this yourself?**
Yes. I designed and built it, using AI coding tools to move fast, the way most startups build today. Every part is tested automatically.

**What is the tech stack?**
React and TypeScript on the front end, a Hono API on Vercel in Dublin, Supabase Postgres in Ireland, Claude for the AI features, Resend for email.

**Does it scale?**
The parts are managed services that scale on demand: Vercel's CDN and functions, Supabase Postgres. Moving to paid tiers is a configuration change, not a rewrite. The expensive part, AI, is metered per project and capped daily.

**What happens if Vercel or Supabase goes down?**
Both are widely used providers with status monitoring. Supabase is standard Postgres, so the data can move to any Postgres host. Next step: paid tiers with daily backups.

**How much does each user cost you?**
Hosting is close to zero at this size. AI costs a few cents per brief breakdown; free projects get 5 breakdowns and 5 statements, so a free group costs well under 1 euro.

**What about AI costs getting out of control?**
Every project has a usage allowance reserved in the database before each call, and there is a hard daily ceiling across the whole service.

### Data, privacy, legal

**Is it GDPR compliant?**
It is built for GDPR from the start: data in Ireland, name and email only, no tracking, immediate deletion, one-click export, automatic deletion of old projects. The privacy policy and terms are published and are being reviewed before full launch.

**Where is the data stored?**
In Ireland (Supabase in eu-west-1) with the API in Dublin. The brief text is processed by Anthropic under EU standard contractual clauses and is not used to train models.

**Is the company registered?**
Not yet. I operate Nexa as a sole operator, and payments are switched off until the business is registered. Registering is the next step, and incubation through the Rubicon Centre is part of that plan.

**Who owns the IP? It started as a university project.**
I built it myself and own the code. (Confirm MTU's student IP policy before the final so this answer is certain.)

**Is the name Nexa protected?**
Not yet. I have checked the EU trademark register (do this before Friday) and will file once the business is registered. The domain nexa-groups.com is secured.

**How do you handle security?**
Every table is protected by Row Level Security inside the database, with automated tests that prove one group cannot read another's data. There is a published security policy and a security.txt contact.

### Business

**How do you make money?**
Have one answer ready and keep it consistent. The app currently has: free first project, 2 euro to unlock another project, 7.99 euro per month for unlimited use. The pitch plan has: universities and lecturers pay per student per year for the contribution overview. Suggested answer that joins both: "Students start free and can upgrade for a few euro. The real business is institutional: universities pay per student per year for lecturer dashboards and fair group grading."

**Who is the customer, students or universities?**
Students are the users and spread it group by group. Universities are the buyers, because unfair group grading is a complaint they already have to deal with.

**How big is the market?**
278,880 students in Irish higher education in 2024/25 (HEA), nearly all doing group work every semester. The UK and Germany are the next markets.

**What traction do you have?**
Quote exact numbers from the database on the day. As of 23/11/2026: 2 users, 2 groups, 15 tasks, 1 statement. Sign in emails only reached the developer's own address until today (Resend test sender), so real onboarding starts now. Goal by Friday: 3 to 5 real MTU groups.

**What stops a big company from copying it?**
Focus and trust. Big tools are general purpose; Nexa is built around the assignment brief and a tamper-proof record. The moat is the lecturer relationships and integration with university systems, which a generic tool will not prioritise.

**What would you do with investment or incubation?**
Three things: onboard pilot modules at MTU with lecturers, build the lecturer dashboard, and register the company and move hosting to paid tiers.

**What is the roadmap?**
Now: free for student groups at MTU. Next semester: lecturer dashboard and a first paid pilot module. 2027/28: integration with the university learning platform (Canvas, Moodle, Brightspace) so groups and deadlines import automatically. Then other Irish institutions, the UK and Germany.

## 7. Before Friday

- [ ] Redirect `nexa-groups.vercel.app` to `nexa-groups.com` (Vercel, project nexa, Settings, Domains)
- [ ] Merge branch `claude/wizardly-sagan-hk1v0b` (new contact address, this document)
- [ ] Fill `[ADDRESS]` in `legal/terms.md`
- [ ] Decide one business model answer (section 6, Business)
- [ ] EUIPO search for "Nexa" in classes 9 and 42
- [ ] Ask MTU or the Rubicon Centre about student IP
- [ ] Onboard real groups, then requery the numbers for the Proof beat
- [ ] Open the app the day before the final (the free Supabase plan pauses after 7 idle days)
