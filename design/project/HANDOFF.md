# Nexa · Handoff for Claude Code

## Files
- `NexaApp.dc.html` · working responsive prototype. Props: `screen`, `viewState` (default, empty, loading, error, success), `frameWidth`, `embedded`, `openDialog`. All data, copy and logic live in its logic class (static `TASKS`, `BRIEF`, `LOG`, `STATEMENT`, `LEGAL`, `COPY`, `CAL`).
- `NexaScreens.dc.html` · every screen at 375, 768 and 1280 px, with a state switcher and a patterns row (destructive confirmation, toast).
- `NexaComponents.dc.html` · tokens and component sheet.
- Design system: `_ds/jona-klassen-personal-design-system-.../` (tokens/*.css, `Label`, `BarChart`).

## Tokens
Use the CSS variables from the design system. No other colours or fonts.

| Token | Value | Use |
|---|---|---|
| --ink | #141414 | text, primary button, 1pt strong rules, selected state |
| --white | #FFFFFF | cards, inputs, top bar, bottom nav, sidebar |
| --paper | #F7F7F5 | app background, read-only inputs |
| --mist | #E6E8E4 | board columns, avatars, hover, skeletons |
| --sage | #B7BFB5 | 0.5pt hairlines, modal backdrop (flat, no alpha) |
| --stone | #8A8F89 | disabled buttons, chart bars. Never text |
| --graphite | #4A4D4A | secondary text, input borders (8.6 : 1 on white) |
| --slate | #34566A | links, focus ring, split bars |
| --rust | #B4441C | error text, destructive actions, one chart highlight per view |

Fonts: `--font-sans` Hanken Grotesk (UI, headings, labels), `--font-serif` Source Serif 4 (body copy, descriptions, legal text, statement). Sizes in rem so text scales to 200 %.

Spacing: 4, 8, 12, 16, 24, 32, 48, 64, 96 px only. Radius 0. No shadows. No icons: labels, numbers and rules instead. Arrows (←, →) as text only.

Breakpoints (measure container width): mobile < 600, tablet 600 to 1023, desktop ≥ 1024.
- Mobile and tablet: top bar 56 px, project sub-nav (scrolling tabs), bottom nav 56 px with 4 text items.
- Desktop: 248 px left sidebar, no bottom nav.
- Page padding 16 / 24 / 48 px. Content max width 1200 px. Legal text max 68ch.

## Components
Button (primary, secondary, text, destructive-trigger, destructive-confirm, disabled; 44 or 48 px) · TextInput (default, error with "Error:" prefix, read-only copy field) · Select · Textarea · Label (DS component, size "screen") · Badge (To do, In progress, Done, Confirmed, Flagged; text always present) · Avatar (square initials 28/32/40, always with name) · FilterChip (aria-pressed) · Tabs (role tablist, 2px Ink underline + weight) · SegmentedControl (task status) · Card (White, 1pt Ink top rule) · TaskCard · ProgressBar (always with text) · Toast (Ink, role status, 5 s, Dismiss) · InlineNotice (Mist) · ErrorPanel (role alert) · EmptyState · Skeleton (static Mist blocks, no animation) · Modal (≥ 600 px) · BottomSheet (< 600 px) · ConfirmDialog (role alertdialog, optional type-to-confirm) · BottomNav · Sidebar · SubNav · TopBar · QRCode · BarChart (DS).

## Screens
01 landing · 02 signin (form, check your email) · 03 dashboard · 04 create · 05 brief (upload, processing, review) · 06 proposal · 07 invite · 08 join (public) · 09 board (columns ≥ 600 px, tabs below) · 10 task · 11 log · 12 statement · 13 calendar (modal / sheet over board) · 15 groupSettings · 16 account · 17 privacy, terms.

## States
- Loading: static skeleton with a text line, role status. Brief uses its processing step.
- Error: ErrorPanel with specific cause and Try again.
- Empty: full EmptyState for dashboard, board, log, statement, proposal. Partial empty lists for invite, task, group settings, account, calendar. Other screens have no empty case.
- Success: toast with a specific message. Sign in success is the check your email view; brief success is the review view.
- Destructive: delete group (type the group name), delete account (type DELETE), remove member, leave group, revoke calendar link, regenerate calendar link.

## Accessibility
Focus: `*:focus-visible { outline: 2px solid var(--slate); outline-offset: 2px }`. Current nav item uses aria-current plus rule plus weight. Status is written as text. Forms use visible labels. Minimum text 0.75 rem (labels). Rust on white 5.3 : 1, Graphite 8.6 : 1, Slate 7.4 : 1.

## Content rules
Plain factual copy, Irish English, dates DD/MM/YYYY, 24 hour time, prices in EUR. No emoji, no em or en dashes, no marketing language.
