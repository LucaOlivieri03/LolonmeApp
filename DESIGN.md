---
name: LolonmeApp — LOLONMEBOL
description: Official South American football federation matchday dossier grounded on pitch-line geometry.
colors:
  federation-pitch: "#0a4a28"
  federation-pitch-deep: "#07361d"
  federation-pitch-tint: "#edf7f1"
  leather-orange: "#c86e0e"
  leather-orange-bright: "#e68e23"
  tournament-gold: "#e5a00d"
  tournament-gold-soft: "#fef9e6"
  federation-navy: "#0e2747"
  referee-crimson: "#c4202b"
  ivory-paper: "#f6f5f0"
  dossier-surface: "#ffffff"
  ledger-subtle: "#efece3"
  pitch-ink: "#111c15"
  pitch-ink-muted: "#4c5d52"
  hairline-rule: "#d6d3c7"
typography:
  display:
    fontFamily: "Barlow Condensed, Archivo, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Barlow Condensed, Archivo, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.02em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.federation-pitch}"
    textColor: "{colors.dossier-surface}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.federation-pitch-deep}"
  button-season-active:
    backgroundColor: "{colors.leather-orange}"
    textColor: "{colors.dossier-surface}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  dossier-panel:
    backgroundColor: "{colors.dossier-surface}"
    textColor: "{colors.pitch-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-field:
    backgroundColor: "{colors.ivory-paper}"
    textColor: "{colors.pitch-ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: LolonmeApp — LOLONMEBOL

## Overview

**Creative North Star: "Boletín Oficial de Federación en Cancha"**

LolonmeApp treats an amateur friends' football league with the structural authority of a South American football federation matchday dossier grounded on the pitch. Rather than floating shadowed SaaS cards on generic gray backgrounds, the interface rests on crisp technical ivory paper divided by `1px` architectural hairlines, anchored by a committed Federation Pitch Green shell with subtle chalk-line geometry (center-circle arcs and halfway rules) and Tournament Gold trims.

Information density and one-handed post-match speed govern every layout decision. Standings rise immediately above the fold on mobile with a sticky player column, Cup rounds flow horizontally with visual connectors, and every interactive target respects comfortable thumb ergonomics. Generic corporate dashboards, neon esports tropes, and nested card stacks are explicitly rejected.

**Key Characteristics:**
- Committed Federation Pitch Green (`#0a4a28`) header and matchday strips with subtle white chalk-line geometry (`.pitch-chalk-surface`).
- Flat, crisp `1px` structural hairlines (`#d6d3c7`) on technical ivory paper (`#f6f5f0`) instead of blurred drop shadows.
- Leather Orange (`#c86e0e` / `#e68e23`, sampled from the official `Logo.svg` ball) reserved for active selection, focus rings, and season toggles.
- Condensed tabular dorsal typography (`Barlow Condensed`) paired with a clean workhorse UI sans (`Archivo`).

## Colors

The palette pairs warm technical ivory paper with deep federation pitch green, warm leather orange from the official crest, tournament gold for titles, and referee crimson exclusively for alerts and destructive actions.

### Primary
- **Federation Pitch** (`#0a4a28`): Header bar, pitch-line matchday strips, primary buttons, active tabs, Top 7 Cup qualification dorsals, and positive chart series.
- **Federation Pitch Deep** (`#07361d`): Hover states on primary buttons and recessed containers inside the federation shell.
- **Federation Pitch Tint** (`#edf7f1`): Winner highlights in Cup ties, hover washes on table rows, and confirmation banners.

### Secondary
- **Leather Orange** (`#c86e0e`, bright `#e68e23`): Sampled from the leather football in `Logo.svg`. Used for active season selectors, active mobile bottom-nav indicators, keyboard focus rings, caret color, MVP badges, and Wilson CT% series.
- **Tournament Gold** (`#e5a00d`, soft `#fef9e6`): Lower header border rule, `#1` league leader dorsal badge, championship stars (`⭐`), and `Final LOLONMEBOL` accents.

### Tertiary
- **Federation Navy** (`#0e2747`): Team B contrast, secondary admin actions, and F11 special-date badges.
- **Referee Crimson** (`#c4202b`): Strictly reserved for title-tiebreaker alerts, negative H2H (`V − D`) bars, expenses in Pozo, and destructive delete confirmations.

### Neutrals
- **Ivory Paper** (`#f6f5f0`): Primary page canvas (`--background`) and recessed form fields.
- **Dossier Surface** (`#ffffff`): Tables, ledgers, and primary work containers.
- **Ledger Subtle** (`#efece3`): Table header bands and subtle zebra/secondary pills.
- **Pitch Ink** (`#111c15`) & **Pitch Ink Muted** (`#4c5d52`): High-contrast primary and secondary copy (`>= 4.5:1` on both `#ffffff` and `#f6f5f0`).
- **Hairline Rule** (`#d6d3c7`): Structural `1px` borders and table dividers.

## Typography

- **Display & Numerals (`Barlow Condensed`, 600–800):** Page titles (`1.875rem`), section headings (`1.25rem`), dorsal rankings, match scores, table points, and season years. Always rendered with `font-variant-numeric: tabular-nums`.
- **UI & Data (`Archivo`, 400–700):** Dense table cells, labels, form controls, announcements, and body copy.
- **Input Legibility Floor:** All `<input>`, `<select>`, and `<textarea>` elements use `16px` (`text-base`) on mobile (`sm:text-sm` on desktop) to prevent iOS Safari auto-zoom.

## Layout

- **Container:** Centered `max-w-5xl` (`1024px`) with `px-3 sm:px-5` gutters.
- **Responsive Navigation:** Mobile (`< 768px`) uses the fixed 5-item `BottomNav` (`min-h-14`) in the thumb zone; Desktop (`md+`) moves navigation inline into `AppHeader` and hides `BottomNav`.
- **Above-the-Fold Priority:** On `/`, the compact `.pitch-chalk-surface` matchday strip sits directly above the `Tabla Anual | Histórica | Copa` tabs so rankings are visible immediately without scrolling past KPI tiles.
- **Sticky Data Columns:** Wide tables (`StandingsTable`, `AdminPozoTab`) pin the leading identifier column (`#` + `Jugador`, `Mes`) on horizontal scroll.

## Elevation & Depth

**The Flat Dossier Rule.** Depth is communicated through `1px` architectural hairlines (`#d6d3c7`) and subtle tonal shifts (`#f6f5f0` paper vs. `#ffffff` surface vs. `#0a4a28` committed shell), never blurred drop shadows or glassmorphism.

## Shapes

- **Radii:** Tight, architectural corners across the entire app — `rounded-sm` (`4px`) for dorsals and compact badges, `rounded-md` (`6px`) for buttons, inputs, tabs, and bracket ties, `rounded-lg` (`8px`) for top-level panels and tables.
- **No One-Sided Rounded Bars:** Never use `border-l-4` on rounded boxes to indicate status or qualification zones; use full borders, subtle tints, or leading dorsal badges.

## Components

- **AppHeader:** Sticky `60px` Federation Pitch Green bar with `2px` Tournament Gold bottom border, clean circular `Logo.svg` crest, `Barlow Condensed` wordmark, inline desktop nav, `AnthemPlayer`, and Admin button.
- **StandingsTable:** Scrollable ledger with sticky `#` and `Jugador` columns, dorsal qualification badges (Gold `#1`, Pitch `#2–7`, soft Gold `#8–9`), tabular `Barlow Condensed` points, and crisp legend.
- **CupBracketView:** Horizontal progression bracket (`Fase Previa → Cuartos → Semis → Final → Final LOLONMEBOL`) with inter-round connector stubs and elevated styling for `Final LOLONMEBOL`.
- **Interactive Controls:** Minimum `40px–44px` (`min-h-10` / `min-h-11`) touch targets everywhere; two-step inline confirmation for all destructive deletions.
- **Browser Surfaces:** Custom `::selection` (`#0a4a28` / `#f6f5f0`), Leather Orange `caret-color` and `:focus-visible` outlines, themed thin scrollbars.

## Do's and Don'ts

- **Do** use `Logo.svg` for header/small icons and reserve `LogoLOLONMEBOL.svg` for large display contexts where the wordmark is legible.
- **Do** format all dates and currencies through `formatDateEs`, `formatMonthKeyEs`, and `formatArs` in `src/lib/utils.ts`.
- **Do** keep form inputs at `16px` (`text-base`) on mobile and touch targets at `>= 40px`.
- **Don't** place eyebrows or kicker labels above headings.
- **Don't** nest bordered cards inside other cards or reintroduce generic KPI metric tile grids.
- **Don't** use mowed-grass stripes, neon glows, gradient text, or `border-l-4` bars on rounded containers.
