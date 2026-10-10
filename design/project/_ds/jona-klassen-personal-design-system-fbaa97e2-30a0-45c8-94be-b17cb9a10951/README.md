# Jona Klassen — Personal Design System

A personal visual identity for **Jona Klassen**, student on the BA (Hons) Creative Digital Media at **Munster Technological University (MTU), Cork**. It is used for written assignments (A4 Word documents), reports and presentation slides (PowerPoint / Google Slides, 16:9). Version 1.0, September 2026.

It is **not** a web product. The two "surfaces" are:
1. **Assignment documents** — A4 portrait, printed or exported to PDF.
2. **Presentations** — 960 × 540 pt slides (= 1280 × 720 px here).

## Sources
- GitHub: **https://github.com/klassenjona4/personal-design-system** (branch `main`)
  - `Design System Reference.dc.html` — full reference: reference analysis, colour, type, layout, document + slide components, data vis, imagery, rules.
  - `Samples.dc.html` — cover page, body page, title/image/chart slides at actual size.
  - `Brand Sheet A4.dc.html` — one-page A4 summary.
  Explore these files directly for exact values when building something new; everything here was lifted from them.

## Index
- `styles.css` — entry point (`@import`s only) → `tokens/fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `borders.css`
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand)
- `components/core`, `components/document`, `components/slides`, `components/data` — React primitives (+ `.d.ts`, `.prompt.md`, one card per folder)
- `slides/` — one 1280 × 720 card per slide layout
- `ui_kits/assignment/` — A4 assignment recreation; `ui_kits/presentation/` — click-through deck
- `thumbnail.html`, `SKILL.md`, `github.md`

## Components
Inventory = the source's own "Document components", "Slide components" and "Data visualisation" sections.
- **core:** Label, ImagePlaceholder
- **document:** DocPage, CoverPage, TableOfContents, Heading, Paragraph, BlockQuote, Figure, DataTable, Footnotes, ReferenceList
- **slides:** Slide, SlideMeta, TitleSlide, SectionDivider, ContentSlide, ImageSlide, ChartSlide, QuoteSlide, ClosingSlide
- **data:** BarChart, GroupedBarChart

### Intentional additions
- **Label** — the source's recurring uppercase label style, factored out ("their role is taken by small uppercase labels").
- **ImagePlaceholder** — the source's Mist/Sage image boxes with bracketed descriptions, plus B&W rendering of real photos.
- **Slide, SlideMeta, DocPage** — shared frames the layouts are built on.

---

## CONTENT FUNDAMENTALS
- **Tone:** plain, factual, academic. Sentences state what something is and how to use it: "Slide background. Reduces glare on projectors compared with pure white."
- **Voice:** impersonal and instructional; imperative for rules ("Left-align all text.", "Leave space empty when there is nothing to put in it."). No "we"; "you/your" only occasionally in setup notes ("Install the static files on your computer"). Assignment content is third-person academic prose with Harvard citations: "Bringhurst (2004) describes a line of 45 to 75 characters…"
- **Titles are statements**, not topics: "55 characters per line was the most preferred measure", "Print guidance sets a range, not a single value".
- **Casing:** sentence case everywhere (headings, slide titles, labels in source text). All caps only via the Label style. Cover titles may be title case ("Line Length and Readability in On-Screen Typography").
- **Spelling:** British/Irish English — colour, visualisation, centre, programme, "3rd edn."
- **Numbers & units:** pt and mm given for Word/PowerPoint entry; "32 / 35 pt"; ratios with spaced colon "18.42 : 1"; thousands with commas "1,980"; dates "24 October 2026" or "24.10.2026" in slide meta rows; "cpl" defined in the source line.
- **Separators:** middle dot " · " joins metadata ("Assignment 1 · Research essay"); arrows "→" only for cross-document links.
- **Placeholders:** square brackets — "[Student Name]", "[R00000000]", "[B&W photograph: student reading at a desk, 8:9 crop]".
- **Limits:** max 50 words and three points per slide; quotes max 25 words on slides; every figure/table numbered and sourced, invented data labelled ("Source: example data for demonstration, n = 42").
- **Emoji:** never. No exclamation marks, no marketing language.

## VISUAL FOUNDATIONS
- **Mood:** calm, editorial, corporate. Derived from four reference decks (B&W branding deck, slate-blue product deck, two black/off-white/sage business decks). Content is given space; nothing competes with it.
- **Colour:** near-black Ink (#141414) and White/Paper carry everything. Cool muted neutrals Mist → Sage → Stone → Graphite. One cool hue, Slate (#34566A), for links, figure numbers and chart series 1. One warm accent, Rust (#B4441C), for **one** highlighted value per page/slide, never paragraphs. Proportion ≈ White/Paper 60, Ink 25, neutrals 10, Slate 4, Rust 1. Slate Light and Sage Dark are chart-only.
- **Type:** Hanken Grotesk (headings, labels, captions, data; SemiBold 600 for headings, Bold 700 only for H3) + Source Serif 4 (body, quotes, footnotes, references). Hierarchy by size contrast; tight negative tracking only at Title/H1 (−1% to −3%), labels +8% caps. Minimum 8 pt in documents, 12 pt on slides. Italic for emphasis in body, SemiBold in headings; no underline except links.
- **Layout:** strict left alignment, asymmetric splits (title one side, text/image the other). A4: 25/30 mm margins, 6 × 20 mm columns, 6 mm gutter, running header/footer 12.5 mm from edge. Slides: 48 pt margins, 12 × 50 pt columns, 24 pt gutter, content from 96 pt, 12 pt metadata row 24 pt from top/bottom.
- **Spacing:** 4 pt base; only 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96. Wide margins, large empty areas left empty.
- **Backgrounds:** flat colour only. White for pages, Paper for slides, Ink for section dividers + closing slide, Mist for quote slides. Sage is the "desk" behind A4 previews. **No gradients, textures, patterns, 3D renders or illustrations.**
- **Imagery:** documentary black-and-white photographs (people working, studios, architecture), natural light, neutral backgrounds; colour kept only when colour is the subject. Ratios 3:2, 4:5, 1:1, 16:9 cropped to grid columns; full-bleed half-slide or rows of equal tiles. Never text over images. Every image numbered and credited.
- **Borders/rules:** 0.5 pt Sage hairlines (table rows, gridlines, TOC), 1 pt Ink strong rules (table top/bottom, cover field block, chart baseline, title-slide meta). Tables: no vertical lines, no fills.
- **Corners:** square (radius 0) everywhere — rounded cards and pills are explicitly rejected.
- **Shadows / elevation:** none. Panels are flat Mist/White fills. No glows, blur or transparency.
- **Cards:** square flat panel (White on Paper, or Mist), optionally a 1 px Ink top rule with an uppercase label above text.
- **Charts:** title states the finding; direct labels; ≤5 horizontal 0.5 pt Sage gridlines; 1 pt Ink baseline; axes from zero; highlight = Rust vs Stone; tabular numerals right-aligned.
- **Animation:** none beyond PowerPoint "simple appear". No transitions.
- **Hover/press:** not a web system. For the rare on-screen link: Slate, underlined, hover → Ink. No buttons exist ("no pills or arrow buttons").
- **Fixed elements:** slide metadata rows and document running headers/page numbers are the only persistent furniture.

## ICONOGRAPHY
The system uses **no icons**. The rules forbid "clip art, icons or decorative images that carry no information"; outlined pills and circled arrows from the references were deliberately dropped. Their role is taken by uppercase Labels, numbers (section "02", "Figure 1.") and rules. No icon font, SVG set, PNGs or emoji. Unicode used as typography only: middle dot ·, arrows → ← for document links, en dash –, minus −, multiplication ×. If an icon ever becomes unavoidable, ask first; do not substitute a CDN set.

## Logo / brand mark
No logo exists in the source. Wherever a mark would go, set the name ("Jona Klassen", or "[Student Name]" in templates) in Hanken Grotesk SemiBold with −3% tracking. `assets/` is intentionally absent — there were no images, logos or fonts in the repo.

## Fonts
Loaded from Google Fonts (`tokens/fonts.css`), exactly as the source does — no font binaries were provided. For Word/PowerPoint install the static files from Google Fonts; in Google Slides use Fonts → More fonts.
