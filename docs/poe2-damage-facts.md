# PoE 2 Damage Mechanics — Facts Reference

Source: ChatGPT research summary, based on PoE2DB, Mobalytics guides, and official 0.5.0 patch notes.
Items marked **[uncertain]** should be treated as configurable data, not hardcoded logic.

---

## 1. Damage Types

| Type      | Category      | Mitigation                         |
| --------- | ------------- | ---------------------------------- |
| Physical  | Non-elemental | Armour / Physical Damage Reduction |
| Fire      | Elemental     | Fire Resistance                    |
| Cold      | Elemental     | Cold Resistance                    |
| Lightning | Elemental     | Lightning Resistance               |
| Chaos     | Non-elemental | Chaos Resistance                   |

Fire, Cold, and Lightning are collectively called **Elemental Damage**.

---

## 2. Hit vs Damage Over Time

- A **Hit** is an instant damage event. It can interact with accuracy, evasion, crit, block, armour, resistance penetration, and "on hit" effects.
- A **Damage over Time (DoT)** deals damage per tick. It does NOT hit, does NOT crit by default, cannot be evaded, and cannot use penetration.
- Ground effects and DoT effects cannot be avoided by hit-avoidance checks.

---

## 3. Attack vs Spell

- **Attacks** use the equipped weapon for base damage, attack speed, and base critical strike chance.
- **Spells** have their own base damage (from the skill gem level), cast speed, and base crit chance. They do NOT use weapon damage, attack speed, or weapon crit unless explicitly stated.

---

## 4. Core Damage Pipeline (Order of Operations)

```
1. Avoidance check (hit or miss)
2. Base damage + added flat damage
3. Skill-inherent conversion / gain
4. Secondary conversion / gain
5. Source-side damage scaling (increased / more)
6. Crit multiplier
7. Double / triple damage multiplier (if applicable)
8. Target-side mitigation (resistance, armour, damage taken modifiers)
9. Final damage event
10. DPS = damage per event × events per second × hit chance × uptime
11. Ailment / DoT are separate downstream damage events
```

Key rule: **Damage does not remember its original type after conversion.** Converted damage scales only by its new type.

---

## 5. Increased vs More

- **Increased / Reduced** — additive within the same pool.
- **More / Less** — multiplicative; each "more" modifier is its own separate multiplier.

Example:

```
base = 100
+40% increased spell, +30% increased fire, +20% increased elemental = 90% total increased
afterIncreased = 100 * (1 + 0.90) = 190

with 25% more and 30% more:
final = 190 * 1.25 * 1.30 = 308.75
```

---

## 6. Base Damage

### Attacks

```
weaponAverageDamage[type] = (weaponMin[type] + weaponMax[type]) / 2
attackBase[type] = weaponAverageDamage[type] * skillAttackDamageMultiplier
```

### Spells

```
spellBase[type] = skillGemBaseAverageDamageAtLevel[type]
```

Gem level is a primary damage scaler for spells (changes the base damage table).

---

## 7. Flat Added Damage

Added damage is applied to base before conversion/gain and before increased/more scaling.

- For **attacks**: `base[type] = weaponDamage[type] + addedFlat[type] * addedDamageEffectiveness`
- For **spells**: `base[type] = gemBaseDamage[type] + addedFlat[type] * addedDamageEffectiveness`

---

## 8. Damage Conversion

Two-step process:

1. Skill-inherent conversion / gain (applied first)
2. All other conversion / gain

Rules:

- Damage over time **cannot** be converted.
- After conversion, damage scales by its **new type only**.
- If non-skill conversions from one type exceed 100%, they are normalised proportionally.

Normalisation example:

```
100 physical
80% phys → fire
40% phys → cold
total = 120% → normalised: fire=66.67%, cold=33.33%
physical = 0
```

---

## 9. Gain as Extra Damage

```
100 physical + 25% gain as extra fire → physical = 100, fire += 25
```

- Gain does NOT remove the original type.
- Gain only works for hit damage, not DoT.
- Calculated before damage scaling (same step as conversion).

---

## 10. Accuracy and Hit Chance (Attacks only)

```
chanceToHit = clamp(
  accuracy * 1.25 / (accuracy + targetEvasion * 0.3),
  0.05,
  1.00
)
```

- Spells do not use accuracy (chanceToHit = 1.0) unless explicitly stated. **[uncertain for edge cases]**
- Accuracy falloff starts at 2 metres and reaches up to 90% less accuracy at 9+ metres (patch 0.3.0 change).

---

## 11. Critical Strikes

### Critical Chance

```
effectiveCritChance = clamp(
  (baseCritChance + flatAddedBaseCritChance)
  * (1 + increasedCritChance / 100)
  * product(moreCritChanceMultipliers),
  0,
  critCap
)
```

- critCap = 100% (safe default). **[uncertain]**
- Attacks use **weapon base crit chance**. Spells use the skill's listed base crit chance.

### Critical Damage Bonus

- Default Critical Damage Bonus = **+100%**, so a crit deals **200%** of normal hit damage.
- Expected damage multiplier: `1 + critChance * criticalDamageBonus`

Example:

```
critChance = 25%, criticalDamageBonus = 150%
expectedCritMultiplier = 1 + 0.25 * 1.50 = 1.375
```

---

## 12. Current Core Ailments (PoE 2 only — NOT Scorch/Brittle/Sap)

| Ailment     | Type      | Damaging | Notes                                |
| ----------- | --------- | -------- | ------------------------------------ |
| Ignite      | Fire      | Yes      | Fire DoT                             |
| Bleed       | Physical  | Yes      | Physical DoT, bypasses Energy Shield |
| Poison      | Chaos     | Yes      | Chaos DoT, bypasses Energy Shield    |
| Shock       | Lightning | No       | Target takes increased damage taken  |
| Chill       | Cold      | No       | Slows target                         |
| Freeze      | Cold      | No       | Prevents action                      |
| Electrocute | Lightning | No       | Interrupts / prevents action         |

**Scorch, Brittle, and Sap are NOT current core PoE 2 ailments.**

---

## 13. Ignite

```
igniteBaseDps = 20% * fireDamageOfIgnitingHitBeforeTargetMitigation
baseIgniteDuration = 4 seconds
```

- Uses the fire hit damage before target mitigation (includes source-side modifiers and crit).
- **Fire penetration does NOT help Ignite.**
- Ignite is not automatic — chance is based on fire damage dealt relative to enemy ailment threshold.
- Elemental Focus support prevents inflicting Ignite.

```
igniteDps = igniteBaseDps * ailmentMagnitudeModifiers * targetFireDotMitigation * damageTakenModifiers
```

---

## 14. Bleed

```
bleedBaseDps = 15% * physicalDamageOfHitBeforeTargetMitigation
baseDuration = 5 seconds
```

- Bypasses Energy Shield.
- Requires explicit chance to bleed.
- Moving enemies (or aggravated bleed): `+100% damage`.
- Note (0.5.0): bleeds **on players** no longer increase while moving; bleeds players apply to monsters still do.

```
bleedDps = bleedBaseDps * bleedMagnitudeModifiers * movingOrAggravatedMultiplier * targetPhysicalDotMitigation
```

---

## 15. Poison

```
poisonBaseDps = 20% * preMitigationPhysicalAndChaosHitDamage
baseDuration = 2 seconds
```

- Bypasses Energy Shield.
- Physical and Chaos hit damage both contribute to Poison magnitude.
- **Penetration does NOT affect Poison.**
- Max stack behaviour: **[uncertain]** — treat as configurable.

```
poisonDps = poisonBaseDps * poisonMagnitudeModifiers * targetChaosDotMitigation * damageTakenModifiers
```

---

## 16. Shock

- Default effect: **+20% increased damage taken** by shocked target.
- Duration: 4 seconds on players, 8 seconds on non-players.
- Chance: ~1% per 4% of enemy ailment threshold dealt as lightning damage.
- Magnitude scales with "increased shock magnitude" modifiers. **[uncertain: caps and "more ailment magnitude" interactions]**

```
shockDamageTakenIncrease = baseShockIncrease * (1 + increasedShockMagnitude / 100)
```

---

## 17. Chill and Freeze

- Cold hits chill by default if they meet the minimum magnitude.
- Chill magnitude is based on cold damage relative to enemy ailment threshold.
- Minimum chill: 30%, default maximum: 50%.
- Freeze builds up from cold hits and prevents action when applied.

---

## 18. Resistances

```
damageTakenMultiplier = 1 - effectiveResistance / 100
```

Examples:

- 50% resistance → ×0.50 damage taken
- -20% resistance → ×1.20 damage taken

### Exposure

- Default Exposure: **-20% resistance**, lasts 4 seconds.
- Multiple exposures of the same type do NOT stack — strongest applies.

### Curses

- Elemental Weakness: **-30% elemental resistances**.

### Resistance calculation order

```
resAfterReductions = baseResistance - exposure - curses - otherReductions
```

---

## 19. Resistance Penetration

- **Hits only** — does NOT apply to ailments or DoT.
- In PoE 2, penetration can only reduce resistance down to **0%** by default (cannot go negative via penetration).

```
if (resAfterReductions > 0) {
  effectiveResForHit = max(0, resAfterReductions - penetration)
} else {
  effectiveResForHit = resAfterReductions  // already negative, penetration adds nothing
}
```

---

## 20. Armour and Physical Mitigation

```
armourReduction = armour / (armour + 10 * physicalHitDamage)
armourReduction = clamp(armourReduction, 0, 0.90)
```

**[uncertain]** — Exact current constant (10×) should be treated as configurable. PoE 2 may differ from PoE 1.

### Armour Break

- Fully broken armour lasts 12 seconds on enemies, 4 seconds on players.
- Non-player targets with fully broken armour take **+20% increased Physical hit damage**.

### Crushed

- Lowers Physical Damage Reduction by **15%**, can push it negative.

```
effectiveArmour = max(0, armour - armourBreakAmount)
armourReduction = effectiveArmour / (effectiveArmour + armourConstant * physicalHit)
physicalTakenMultiplier = 1 - armourReduction - otherPhysicalDamageReduction + increasedPhysicalDamageTaken
```

---

## 21. Area of Effect (AoE)

- AoE size ≠ damage unless a modifier explicitly says **Area Damage**.
- Concentrated Area Support: `+30% more Area Damage`, `-50% less Area of Effect`.
- Apply area damage modifiers only to skills tagged as AoE.

---

## 22. Projectile Skills

- Projectile damage modifiers apply to projectile-tagged skills.
- More projectiles ≠ more single-target DPS automatically; depends on skill-specific overlap rules. **[uncertain per skill]**

---

## 23. Support Gems

- Support "more" and "less" modifiers are multiplicative with each other and with other more/less modifiers.
- Example: `25% more` support A + `30% more` support B = `×1.25 × 1.30 = ×1.625`.
- Elemental Focus: `+25% more Elemental Damage`, but **cannot inflict elemental ailments** (Ignite, Shock, Chill, Freeze).
- Gem and support values changed significantly in **patch 0.5.0** — treat as versioned data.

---

## 24. Key PoE 2 vs PoE 1 Differences

| Area           | PoE 2 Rule                                                     |
| -------------- | -------------------------------------------------------------- |
| Conversion     | Two-step; no old-type memory after conversion                  |
| Penetration    | Hits only; cannot penetrate below 0% by default                |
| Crit           | Critical Damage Bonus; default crit = 200%, not PoE 1 framing  |
| Ailments       | Scorch/Brittle/Sap are NOT core PoE 2 ailments                 |
| Ignite chance  | Not automatic; threshold/mechanic based                        |
| Shock default  | +20% increased damage taken                                    |
| Evasion        | Works against all hits except boss red-flash hits (from 0.3.0) |
| Armour formula | Similar shape to PoE 1 but exact constant is **[uncertain]**   |
| Gem values     | 0.5.0 changed many; must be data-driven per patch              |

---

## 25. The Two Most Important Implementation Rules

```
1. Do NOT apply old-type scaling after conversion.
   (Physical converted to Fire scales as Fire only.)

2. Do NOT let penetration affect DoTs, and do NOT reduce resistance below 0 via penetration.
```
