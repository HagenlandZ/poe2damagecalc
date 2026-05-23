import { useDamageStore } from "../../store/damageStore";
import { Panel } from "../shared/Panel";
import { DAMAGE_TYPES } from "../../calc/types";
import type { DamageType } from "../../calc/types";

const TYPE_LABELS: Record<DamageType, string> = {
  physical: "Physical",
  fire: "Fire",
  cold: "Cold",
  lightning: "Lightning",
  chaos: "Chaos",
};

export function BaseDamagePanel() {
  const baseDamageMin = useDamageStore((s) => s.baseDamageMin);
  const baseDamageMax = useDamageStore((s) => s.baseDamageMax);
  const addedFlat = useDamageStore((s) => s.addedFlat);
  const addedDamageEffectiveness = useDamageStore(
    (s) => s.addedDamageEffectiveness,
  );
  const setBaseDamageMin = useDamageStore((s) => s.setBaseDamageMin);
  const setBaseDamageMax = useDamageStore((s) => s.setBaseDamageMax);
  const setAddedFlat = useDamageStore((s) => s.setAddedFlat);
  const setAddedDamageEffectiveness = useDamageStore(
    (s) => s.setAddedDamageEffectiveness,
  );

  return (
    <Panel title="Damage">
      {/* Base min / max */}
      <div className="dmg-table">
        <div className="dmg-table__head">
          <span />
          <span>Min</span>
          <span>Max</span>
          <span>Avg</span>
        </div>
        {DAMAGE_TYPES.map((t) => (
          <div key={t} className="dmg-table__row">
            <span className={`dt-tag dt-tag--${t}`}>{TYPE_LABELS[t]}</span>
            <input
              className="num-input num-input--sm"
              type="number"
              min={0}
              value={baseDamageMin[t]}
              onChange={(e) =>
                setBaseDamageMin(t, parseFloat(e.target.value) || 0)
              }
            />
            <input
              className="num-input num-input--sm"
              type="number"
              min={0}
              value={baseDamageMax[t]}
              onChange={(e) =>
                setBaseDamageMax(t, parseFloat(e.target.value) || 0)
              }
            />
            <span className="dmg-table__avg">
              {Math.round((baseDamageMin[t] + baseDamageMax[t]) / 2)}
            </span>
          </div>
        ))}
      </div>

      {/* Added flat */}
      <div className="section-divider">Added Flat Damage</div>
      <div className="dmg-table">
        {DAMAGE_TYPES.map((t) => (
          <div key={t} className="dmg-table__row">
            <span className={`dt-tag dt-tag--${t}`}>{TYPE_LABELS[t]}</span>
            <input
              className="num-input num-input--sm"
              type="number"
              min={0}
              style={{ gridColumn: "2 / 4" }}
              value={addedFlat[t]}
              onChange={(e) => setAddedFlat(t, parseFloat(e.target.value) || 0)}
            />
            <span className="dmg-table__avg">
              {Math.round((addedFlat[t] * addedDamageEffectiveness) / 100)}
            </span>
          </div>
        ))}
      </div>
      <div className="field" style={{ marginTop: "0.5rem" }}>
        <span className="field__label">Effectiveness</span>
        <input
          className="num-input"
          type="number"
          min={0}
          max={200}
          value={addedDamageEffectiveness}
          onChange={(e) =>
            setAddedDamageEffectiveness(parseFloat(e.target.value) || 0)
          }
        />
        <span className="field__suffix">%</span>
      </div>
      <p className="field__note">
        Avg column shows flat after effectiveness scaling.
      </p>
    </Panel>
  );
}
