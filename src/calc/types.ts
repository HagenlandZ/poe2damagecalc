// Damage types used throughout the calculator
export type DamageType = "physical" | "fire" | "cold" | "lightning" | "chaos";
export type DamagePool = Record<DamageType, number>;
export type SourceKind = "attack" | "spell";

export const DAMAGE_TYPES: DamageType[] = [
  "physical",
  "fire",
  "cold",
  "lightning",
  "chaos",
];

export const zeroDamagePool = (): DamagePool => ({
  physical: 0,
  fire: 0,
  cold: 0,
  lightning: 0,
  chaos: 0,
});
