// Stage 1: single-hit damage pipeline
// Pure functions only — no React, no store dependencies.
// See docs/poe2-damage-facts.md for mechanic sources.

import { DamagePool, DamageType, DAMAGE_TYPES, zeroDamagePool } from "./types";

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface ConversionRow {
  from: DamageType;
  to: DamageType;
  /** 0–100 */
  percent: number;
  /** true = "gain as extra" (does not remove source), false = conversion */
  gainAsExtra: boolean;
  /** true = skill-inherent (applied before secondary conversions) */
  skillInherent: boolean;
}

export interface MoreMultiplier {
  label: string;
  /** e.g. 25 for "25% more" */
  value: number;
}

export interface CritInputs {
  /** Base crit chance in % (from weapon or skill) */
  baseCritChance: number;
  /** Flat added base crit chance in % */
  flatAddedBaseCrit: number;
  /** Total increased crit chance in % (additive pool) */
  increasedCritChance: number;
  /** More crit chance multipliers — each applied separately */
  moreCritChance: MoreMultiplier[];
  /** Critical Damage Bonus in % (default 100 = 200% hit on crit) */
  criticalDamageBonus: number;
}

export interface EnemyInputs {
  resistances: DamagePool;
  /** Per-type penetration (hits only; cannot push res below 0 via penetration) */
  penetration: Partial<DamagePool>;
  /** Flat resistance reductions (e.g. exposure -20, curses -30) */
  reductions: Partial<DamagePool>;
  /** Enemy armour (physical mitigation) */
  armour: number;
  /** Armour formula constant — configurable, default 10 [uncertain] */
  armourConstant: number;
  /** Extra % physical damage taken (e.g. armour break +20%) */
  increasedPhysicalDamageTaken: number;
}

export interface HitInputs {
  /** Average base damage per type before any modifiers */
  baseDamage: DamagePool;
  /** Added flat damage per type (already multiplied by addedDamageEffectiveness outside) */
  addedFlat: DamagePool;
  conversionRows: ConversionRow[];
  /** Total increased damage — all additive % increases summed (spell, fire, elemental, area, generic…) */
  totalIncreasedPercent: number;
  moreMultipliers: MoreMultiplier[];
  crit: CritInputs;
  enemy: EnemyInputs;
}

// ---------------------------------------------------------------------------
// Step 1: base + flat
// ---------------------------------------------------------------------------

export function applyFlat(base: DamagePool, flat: DamagePool): DamagePool {
  const out = zeroDamagePool();
  for (const t of DAMAGE_TYPES) {
    out[t] = base[t] + flat[t];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 2: conversion + gain
// Skill-inherent rows are processed first, then all other rows.
// After conversion the damage only scales by its new type.
// ---------------------------------------------------------------------------

export function applyConversions(
  pool: DamagePool,
  rows: ConversionRow[],
): DamagePool {
  const out: DamagePool = { ...pool };

  const applyGroup = (groupRows: ConversionRow[]) => {
    // Group non-gain rows by source type to check for normalisation
    const conversionBySource: Partial<Record<DamageType, ConversionRow[]>> = {};
    for (const row of groupRows) {
      if (!row.gainAsExtra) {
        conversionBySource[row.from] ??= [];
        conversionBySource[row.from]!.push(row);
      }
    }

    // Normalise if total exceeds 100% for a source type
    for (const [fromType, convRows] of Object.entries(conversionBySource) as [
      DamageType,
      ConversionRow[],
    ][]) {
      const total = convRows.reduce((s, r) => s + r.percent, 0);
      const scale = total > 100 ? 100 / total : 1;

      for (const row of convRows) {
        const amount = out[fromType] * (row.percent / 100) * scale;
        out[fromType] -= amount;
        out[row.to] += amount;
      }
    }

    // Gain as extra (no removal of source)
    for (const row of groupRows) {
      if (row.gainAsExtra) {
        const amount = out[row.from] * (row.percent / 100);
        out[row.to] += amount;
      }
    }
  };

  applyGroup(rows.filter((r) => r.skillInherent));
  applyGroup(rows.filter((r) => !r.skillInherent));

  return out;
}

// ---------------------------------------------------------------------------
// Step 3: increased + more scaling
// ---------------------------------------------------------------------------

export function applyScaling(
  pool: DamagePool,
  totalIncreasedPercent: number,
  moreMultipliers: MoreMultiplier[],
): DamagePool {
  const out = zeroDamagePool();
  const increasedMult = 1 + totalIncreasedPercent / 100;
  const moreMult = moreMultipliers.reduce(
    (acc, m) => acc * (1 + m.value / 100),
    1,
  );

  for (const t of DAMAGE_TYPES) {
    out[t] = pool[t] * increasedMult * moreMult;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 4: crit — returns { nonCrit, crit, expectedCritMultiplier, effectiveCritChance }
// ---------------------------------------------------------------------------

export interface CritResult {
  effectiveCritChance: number;
  critHitMultiplier: number;
  expectedCritMultiplier: number;
}

export function calcCrit(inputs: CritInputs): CritResult {
  const moreMult = inputs.moreCritChance.reduce(
    (acc, m) => acc * (1 + m.value / 100),
    1,
  );
  const effectiveCritChance = Math.min(
    ((inputs.baseCritChance + inputs.flatAddedBaseCrit) *
      (1 + inputs.increasedCritChance / 100) *
      moreMult) /
      100,
    1,
  );
  const critHitMultiplier = 1 + inputs.criticalDamageBonus / 100;
  const expectedCritMultiplier =
    1 + effectiveCritChance * (inputs.criticalDamageBonus / 100);

  return { effectiveCritChance, critHitMultiplier, expectedCritMultiplier };
}

// ---------------------------------------------------------------------------
// Step 5: enemy mitigation
// ---------------------------------------------------------------------------

function effectiveResistance(
  base: number,
  reduction: number,
  penetration: number,
): number {
  const afterReductions = base - reduction;
  // Penetration can only bring positive resistance down to 0
  if (afterReductions > 0) {
    return Math.max(0, afterReductions - penetration);
  }
  return afterReductions;
}

export function applyMitigation(
  pool: DamagePool,
  enemy: EnemyInputs,
): DamagePool {
  const out = zeroDamagePool();

  for (const t of DAMAGE_TYPES) {
    if (t === "physical") {
      // Armour reduction (capped at 90%)
      const totalDmg = pool[t];
      if (totalDmg === 0) continue;
      const armourReduction = Math.min(
        enemy.armour / (enemy.armour + enemy.armourConstant * totalDmg),
        0.9,
      );
      const physReduction = armourReduction;
      const mult =
        (1 - physReduction) *
        (1 + (enemy.increasedPhysicalDamageTaken ?? 0) / 100);
      out[t] = pool[t] * mult;
    } else {
      const res = effectiveResistance(
        enemy.resistances[t],
        enemy.reductions[t] ?? 0,
        enemy.penetration[t] ?? 0,
      );
      out[t] = pool[t] * (1 - res / 100);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Full pipeline — returns each step for display
// ---------------------------------------------------------------------------

export interface PipelineResult {
  afterFlat: DamagePool;
  afterConversion: DamagePool;
  afterScaling: DamagePool;
  crit: CritResult;
  /** Post-scaling, pre-mitigation, with expected crit multiplier applied */
  preMitigation: DamagePool;
  /** Final damage per type */
  postMitigation: DamagePool;
  /** Sum of postMitigation */
  totalHit: number;
  /** Non-crit hit (for comparison) */
  nonCritPostMitigation: DamagePool;
  nonCritTotalHit: number;
}

export function runPipeline(inputs: HitInputs): PipelineResult {
  const afterFlat = applyFlat(inputs.baseDamage, inputs.addedFlat);
  const afterConversion = applyConversions(afterFlat, inputs.conversionRows);
  const afterScaling = applyScaling(
    afterConversion,
    inputs.totalIncreasedPercent,
    inputs.moreMultipliers,
  );

  const crit = calcCrit(inputs.crit);

  // Expected damage (incorporates average crit contribution)
  const preMitigation = zeroDamagePool();
  for (const t of DAMAGE_TYPES) {
    preMitigation[t] = afterScaling[t] * crit.expectedCritMultiplier;
  }
  const postMitigation = applyMitigation(preMitigation, inputs.enemy);
  const totalHit = DAMAGE_TYPES.reduce((s, t) => s + postMitigation[t], 0);

  // Non-crit for comparison
  const nonCritPreMitigation = { ...afterScaling };
  const nonCritPostMitigation = applyMitigation(
    nonCritPreMitigation,
    inputs.enemy,
  );
  const nonCritTotalHit = DAMAGE_TYPES.reduce(
    (s, t) => s + nonCritPostMitigation[t],
    0,
  );

  return {
    afterFlat,
    afterConversion,
    afterScaling,
    crit,
    preMitigation,
    postMitigation,
    totalHit,
    nonCritPostMitigation,
    nonCritTotalHit,
  };
}
