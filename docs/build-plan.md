# Damage Dealer — Build Plan

## Project Overview

An interactive PoE 2 damage model hosted as a GitHub Pages site.
Two sections: **Damage Dealt** (first) and **Damage Received** (later).
Focus is visual clarity — default values that users can modify.

---

## Stage Overview

| Stage | Description                             | Status  |
| ----- | --------------------------------------- | ------- |
| 1     | Single-hit damage pipeline (no DPS)     | 🔜 Next |
| 2     | Add ailments (Ignite, Bleed, Poison)    | Planned |
| 3     | Add DPS (cast/attack speed, hit chance) | Planned |
| 4     | Damage Received section                 | Planned |
| 5     | Polish, sharing/export, GitHub deploy   | Planned |

---

## Stage 1 — Single-Hit Damage Pipeline

**Goal:** Show a single hit's final damage, broken down step-by-step through the pipeline. No DPS yet. No ailments yet.

### What it calculates

```
base damage (weapon or spell gem)
+ added flat damage (× effectiveness)
→ post-conversion base per type
→ × increased damage (additive pool)
→ × more damage multipliers (each separate)
→ × expected crit multiplier
→ target mitigation (resistance, penetration, armour for physical)
= final hit damage per type
= total final hit
```

### UI Components

1. **Source selector** — Attack or Spell toggle
2. **Base damage** — min/max fields (weapon or gem base). Displays average.
3. **Added flat damage** — per type (Fire, Cold, Lightning, Physical, Chaos), with Added Damage Effectiveness field
4. **Conversion panel** — up to 2 conversion rows (from → to, percentage). Gain-as-extra toggle.
5. **Increased damage** — additive inputs: spell %, fire %, elemental %, area %, generic %
6. **More multipliers** — up to 3 "more damage" rows (label + value), each multiplied separately
7. **Crit panel** — base crit %, increased crit %, crit damage bonus %. Shows effective crit chance and expected crit multiplier.
8. **Enemy panel** — resistance per type, exposure toggle (-20%), elemental weakness toggle (-30%), penetration per type
9. **Armour panel** (physical only) — enemy armour, armour constant (configurable, default 10)

### Output Display

- Pipeline breakdown: each step shown as a row with value
- Final damage per type (colour-coded)
- Total final hit
- Crit vs non-crit comparison (two columns)

### Toggles

- Elemental Focus (disables ailments, adds 25% more elemental)
- Concentrated Area (30% more area damage)
- Exposure active (on/off)
- Elemental Weakness curse active (on/off)
- Attack/Spell mode (affects base damage source and whether accuracy applies)

### Out of scope for Stage 1

- Attack speed / cast speed
- Hit chance / accuracy
- Ailments (Ignite, Bleed, Poison, Shock)
- Multiple hits / DPS
- Damage Received section

### Implementation rules (from facts doc)

- Conversion is two-step; apply skill-inherent first
- After conversion, damage scales only by new type
- Penetration only reduces to 0%, never below (via penetration)
- Increased modifiers are one additive pool; more modifiers are separate multipliers

---

## Stage 2 — Ailments

**Goal:** Add a second output panel showing DoT damage from Ignite, Bleed, and Poison triggered by the Stage 1 hit.

### What it adds

- Ignite DPS = 20% × fire hit (pre-mitigation, post source-side scaling) × ailment magnitude × target fire DoT mitigation
- Bleed DPS = 15% × physical hit (pre-mitigation) × ailment magnitude × moving multiplier
- Poison DPS = 20% × (physical + chaos) hit (pre-mitigation) × ailment magnitude × target chaos DoT mitigation
- Shock: show the % increased damage taken applied to the shocked target (affects hit damage, not DoT)

### Toggles to add

- Ignite / Bleed / Poison chance (0–100%)
- Moving target toggle (bleed ×2)
- Elemental Focus toggle already blocks Ignite/Shock

---

## Stage 3 — DPS

**Goal:** Multiply Stage 1 hit by events per second and hit chance.

### What it adds

- Attack speed / cast speed field
- Accuracy rating field (attacks only)
- Enemy evasion field
- Hit chance formula display
- DPS = total hit × hitsPerSecond × chanceToHit
- Ailment DPS integrated (Stage 2 output × uptime)

---

## Stage 4 — Damage Received

**Goal:** Mirror section modelling how incoming damage lands on the player's character.

### Planned mechanics

- Player resistances and caps
- Player armour
- Energy Shield vs Life hit routing
- Block chance
- Evasion / suppress spell damage

---

## Stage 5 — Polish and Deploy

- GitHub Pages deploy (static HTML/CSS/JS — no build step needed)
- Shareable state via URL query string or clipboard JSON
- Preset examples (e.g. "Fire spell vs 0 res", "Bleed attack vs armoured enemy")
- Mobile-friendly layout pass
- README with usage guide

---

## Tech Stack

| Layer         | Choice                           | Reason                                                      |
| ------------- | -------------------------------- | ----------------------------------------------------------- |
| Bundler       | Vite                             | Fast dev server, trivial static build for GitHub Pages      |
| UI            | React + TypeScript               | Component model suits the panel/pipeline layout             |
| State         | Zustand                          | Lightweight; one store per section (dealt / received)       |
| Visualisation | D3.js                            | Pipeline SVG diagram + scaling graphs (damage vs. variable) |
| Hosting       | GitHub Pages (`gh-pages` branch) | Free static hosting, deploy from `dist/`                    |

### D3 usage plan

- **Pipeline diagram** — SVG nodes and arrows showing each calculation step, values updating reactively
- **Scaling graph** — line chart: X = one variable (e.g. crit chance, resistance, increased %), Y = final hit damage. Lets users see diminishing returns, breakpoints, etc.
- D3 is used for drawing only; all damage logic lives in pure TS functions outside React/D3.

### State shape (Zustand)

- One store: `useDamageStore`
- Slices: `sourceInputs`, `modifiers`, `conversionRows`, `critInputs`, `enemyInputs`
- Derived damage values computed via selector functions, not stored
- All **[uncertain]** mechanics constants in a separate `config` slice so they can be edited in the UI

### Project structure (target)

```
src/
  calc/          # Pure TS damage functions (no React, no D3)
    pipeline.ts  # Step-by-step hit pipeline
    conversion.ts
    mitigation.ts
    ailments.ts  # Stage 2
    dps.ts       # Stage 3
  store/
    damageStore.ts
  components/
    inputs/      # Source, base damage, flat, conversion, modifiers, crit, enemy panels
    output/      # Pipeline breakdown, damage-per-type display
    charts/      # D3 pipeline diagram, scaling graph
  App.tsx
docs/            # Facts + plan (this file)
```

---

## Technical Constraints

- Mechanics values marked **[uncertain]** in the facts doc must be editable fields, never hardcoded.
- All damage logic must be pure functions in `src/calc/` — no side effects, no store dependencies.
- D3 instances managed via `useRef` + `useEffect`; do not mix D3 DOM mutations with React render.
- Build output in `dist/` deployed to `gh-pages` branch via `vite build` + `gh-pages` package.

---

## Next Step

**Scaffold the Vite + React + TS project, install dependencies, then build Stage 1.**
