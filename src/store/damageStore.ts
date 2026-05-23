import { create } from "zustand";
import type { DamagePool, SourceKind } from "../calc/types";
import type {
  ConversionRow,
  CritInputs,
  EnemyInputs,
  MoreMultiplier,
} from "../calc/pipeline";
import { zeroDamagePool } from "../calc/types";

// ---------------------------------------------------------------------------
// Toggles
// ---------------------------------------------------------------------------
export interface Toggles {
  elementalFocus: boolean;
  concentratedArea: boolean;
  exposureActive: boolean;
  elementalWeaknessActive: boolean;
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------
export interface DamageState {
  source: SourceKind;

  baseDamageMin: DamagePool;
  baseDamageMax: DamagePool;
  addedFlat: DamagePool;
  addedDamageEffectiveness: number;

  conversionRows: ConversionRow[];

  // Additive increased pool — stored as labelled entries for display
  increasedEntries: { label: string; value: number }[];

  moreMultipliers: MoreMultiplier[];

  crit: CritInputs;

  enemy: EnemyInputs;

  toggles: Toggles;

  // Actions
  setSource: (s: SourceKind) => void;
  setBaseDamageMin: (t: keyof DamagePool, v: number) => void;
  setBaseDamageMax: (t: keyof DamagePool, v: number) => void;
  setAddedFlat: (t: keyof DamagePool, v: number) => void;
  setAddedDamageEffectiveness: (v: number) => void;
  setConversionRows: (rows: ConversionRow[]) => void;
  setIncreasedEntries: (entries: { label: string; value: number }[]) => void;
  setMoreMultipliers: (mm: MoreMultiplier[]) => void;
  setCrit: (c: Partial<CritInputs>) => void;
  setEnemy: (e: Partial<EnemyInputs>) => void;
  setToggle: (key: keyof Toggles, value: boolean) => void;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------
const defaultEnemy: EnemyInputs = {
  resistances: { physical: 0, fire: 40, cold: 40, lightning: 40, chaos: 20 },
  penetration: {},
  reductions: {},
  armour: 1000,
  armourConstant: 10,
  increasedPhysicalDamageTaken: 0,
};

const defaultCrit: CritInputs = {
  baseCritChance: 5,
  flatAddedBaseCrit: 0,
  increasedCritChance: 0,
  moreCritChance: [],
  criticalDamageBonus: 100,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useDamageStore = create<DamageState>((set) => ({
  source: "spell",

  baseDamageMin: { ...zeroDamagePool(), fire: 800 },
  baseDamageMax: { ...zeroDamagePool(), fire: 1200 },
  addedFlat: zeroDamagePool(),
  addedDamageEffectiveness: 100,

  conversionRows: [],

  increasedEntries: [
    { label: "Spell Damage", value: 70 },
    { label: "Fire Damage", value: 40 },
    { label: "Elemental Damage", value: 20 },
  ],

  moreMultipliers: [],

  crit: defaultCrit,
  enemy: defaultEnemy,

  toggles: {
    elementalFocus: false,
    concentratedArea: false,
    exposureActive: false,
    elementalWeaknessActive: false,
  },

  setSource: (s) => set({ source: s }),

  setBaseDamageMin: (t, v) =>
    set((state) => ({ baseDamageMin: { ...state.baseDamageMin, [t]: v } })),

  setBaseDamageMax: (t, v) =>
    set((state) => ({ baseDamageMax: { ...state.baseDamageMax, [t]: v } })),

  setAddedFlat: (t, v) =>
    set((state) => ({ addedFlat: { ...state.addedFlat, [t]: v } })),

  setAddedDamageEffectiveness: (v) => set({ addedDamageEffectiveness: v }),

  setConversionRows: (rows) => set({ conversionRows: rows }),

  setIncreasedEntries: (entries) => set({ increasedEntries: entries }),

  setMoreMultipliers: (mm) => set({ moreMultipliers: mm }),

  setCrit: (c) => set((state) => ({ crit: { ...state.crit, ...c } })),

  setEnemy: (e) => set((state) => ({ enemy: { ...state.enemy, ...e } })),

  setToggle: (key, value) =>
    set((state) => ({ toggles: { ...state.toggles, [key]: value } })),
}));
