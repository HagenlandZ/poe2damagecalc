import { DamageType, DAMAGE_TYPES, zeroDamagePool } from "./types";
import type { HitInputs } from "./pipeline";
import { runPipeline, calcCrit } from "./pipeline";
import type { DamageState } from "../store/damageStore";

export function buildHitInputs(state: DamageState): HitInputs {
  const baseDamage = zeroDamagePool();
  for (const t of DAMAGE_TYPES) {
    baseDamage[t] = (state.baseDamageMin[t] + state.baseDamageMax[t]) / 2;
  }

  const addedFlat = zeroDamagePool();
  for (const t of DAMAGE_TYPES) {
    addedFlat[t] = state.addedFlat[t] * (state.addedDamageEffectiveness / 100);
  }

  const moreMultipliers = [...state.moreMultipliers];
  if (state.toggles.elementalFocus) {
    moreMultipliers.push({ label: "Elemental Focus", value: 25 });
  }
  if (state.toggles.concentratedArea) {
    moreMultipliers.push({ label: "Concentrated Area", value: 30 });
  }

  const elementalTypes: DamageType[] = ["fire", "cold", "lightning"];
  const reductions = { ...state.enemy.reductions };
  if (state.toggles.exposureActive) {
    for (const t of elementalTypes) reductions[t] = (reductions[t] ?? 0) + 20;
  }
  if (state.toggles.elementalWeaknessActive) {
    for (const t of elementalTypes) reductions[t] = (reductions[t] ?? 0) + 30;
  }

  return {
    baseDamage,
    addedFlat,
    conversionRows: state.conversionRows,
    totalIncreasedPercent: state.increasedEntries.reduce(
      (s, e) => s + e.value,
      0,
    ),
    moreMultipliers,
    crit: state.crit,
    enemy: { ...state.enemy, reductions },
  };
}

// ---------------------------------------------------------------------------
// Scaling graph sweep
// ---------------------------------------------------------------------------

export type SweepVariable =
  | "totalIncreased"
  | "critChance"
  | "critBonus"
  | "fireRes"
  | "coldRes"
  | "lightningRes"
  | "chaosRes";

export const SWEEP_VARIABLE_LABELS: Record<SweepVariable, string> = {
  totalIncreased: "Total Increased %",
  critChance: "Crit Chance %",
  critBonus: "Crit Damage Bonus %",
  fireRes: "Enemy Fire Res %",
  coldRes: "Enemy Cold Res %",
  lightningRes: "Enemy Lightning Res %",
  chaosRes: "Enemy Chaos Res %",
};

export const SWEEP_RANGES: Record<SweepVariable, [number, number]> = {
  totalIncreased: [0, 500],
  critChance: [0, 100],
  critBonus: [0, 400],
  fireRes: [-100, 100],
  coldRes: [-100, 100],
  lightningRes: [-100, 100],
  chaosRes: [-100, 100],
};

function applyVariableOverride(
  inputs: HitInputs,
  variable: SweepVariable,
  x: number,
): HitInputs {
  switch (variable) {
    case "totalIncreased":
      return { ...inputs, totalIncreasedPercent: x };
    case "critChance":
      return {
        ...inputs,
        crit: {
          ...inputs.crit,
          baseCritChance: x,
          flatAddedBaseCrit: 0,
          increasedCritChance: 0,
          moreCritChance: [],
        },
      };
    case "critBonus":
      return { ...inputs, crit: { ...inputs.crit, criticalDamageBonus: x } };
    case "fireRes":
      return {
        ...inputs,
        enemy: {
          ...inputs.enemy,
          resistances: { ...inputs.enemy.resistances, fire: x },
          penetration: { ...inputs.enemy.penetration, fire: 0 },
          reductions: { ...inputs.enemy.reductions, fire: 0 },
        },
      };
    case "coldRes":
      return {
        ...inputs,
        enemy: {
          ...inputs.enemy,
          resistances: { ...inputs.enemy.resistances, cold: x },
          penetration: { ...inputs.enemy.penetration, cold: 0 },
          reductions: { ...inputs.enemy.reductions, cold: 0 },
        },
      };
    case "lightningRes":
      return {
        ...inputs,
        enemy: {
          ...inputs.enemy,
          resistances: { ...inputs.enemy.resistances, lightning: x },
          penetration: { ...inputs.enemy.penetration, lightning: 0 },
          reductions: { ...inputs.enemy.reductions, lightning: 0 },
        },
      };
    case "chaosRes":
      return {
        ...inputs,
        enemy: {
          ...inputs.enemy,
          resistances: { ...inputs.enemy.resistances, chaos: x },
          penetration: { ...inputs.enemy.penetration, chaos: 0 },
          reductions: { ...inputs.enemy.reductions, chaos: 0 },
        },
      };
    default: {
      const _exhaustive: never = variable;
      throw new Error(`Unknown sweep variable: ${_exhaustive as string}`);
    }
  }
}

export function sweepVariable(
  inputs: HitInputs,
  variable: SweepVariable,
  steps = 80,
): { x: number; y: number }[] {
  const [min, max] = SWEEP_RANGES[variable];
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = min + (max - min) * (i / steps);
    const modified = applyVariableOverride(inputs, variable, x);
    const { totalHit } = runPipeline(modified);
    points.push({ x, y: totalHit });
  }
  return points;
}

export function getCurrentSweepValue(
  inputs: HitInputs,
  variable: SweepVariable,
): number {
  switch (variable) {
    case "totalIncreased":
      return inputs.totalIncreasedPercent;
    case "critChance":
      return calcCrit(inputs.crit).effectiveCritChance * 100;
    case "critBonus":
      return inputs.crit.criticalDamageBonus;
    case "fireRes":
      return inputs.enemy.resistances.fire;
    case "coldRes":
      return inputs.enemy.resistances.cold;
    case "lightningRes":
      return inputs.enemy.resistances.lightning;
    case "chaosRes":
      return inputs.enemy.resistances.chaos;
    default: {
      const _exhaustive: never = variable;
      throw new Error(`Unknown sweep variable: ${_exhaustive as string}`);
    }
  }
}
