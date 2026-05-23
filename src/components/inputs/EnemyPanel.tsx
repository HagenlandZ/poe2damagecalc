import { useDamageStore } from "../../store/damageStore";
import { Panel } from "../shared/Panel";
import { DAMAGE_TYPES } from "../../calc/types";
import type { DamageType, DamagePool } from "../../calc/types";

const TYPE_LABELS: Record<DamageType, string> = {
  physical: "Physical",
  fire: "Fire",
  cold: "Cold",
  lightning: "Lightning",
  chaos: "Chaos",
};

export function EnemyPanel() {
  const enemy = useDamageStore((s) => s.enemy);
  const setEnemy = useDamageStore((s) => s.setEnemy);

  const setRes = (t: DamageType, v: number) =>
    setEnemy({ resistances: { ...enemy.resistances, [t]: v } });

  const setPen = (t: DamageType, v: number) =>
    setEnemy({ penetration: { ...enemy.penetration, [t]: v } });

  return (
    <Panel title="Enemy">
      <div className="dmg-table dmg-table--enemy">
        <div className="dmg-table__head">
          <span />
          <span>Res %</span>
          <span>Pen %</span>
        </div>
        {DAMAGE_TYPES.map((t) => (
          <div key={t} className="dmg-table__row">
            <span className={`dt-tag dt-tag--${t}`}>{TYPE_LABELS[t]}</span>
            <input
              className="num-input num-input--sm"
              type="number"
              min={-100}
              max={100}
              value={enemy.resistances[t]}
              onChange={(e) => setRes(t, parseFloat(e.target.value) || 0)}
            />
            <input
              className="num-input num-input--sm"
              type="number"
              min={0}
              max={100}
              value={(enemy.penetration as Partial<DamagePool>)[t] ?? 0}
              onChange={(e) => setPen(t, parseFloat(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>

      <div className="section-divider">Physical Mitigation</div>
      <div className="field">
        <span className="field__label">Armour</span>
        <input
          className="num-input"
          type="number"
          min={0}
          value={enemy.armour}
          onChange={(e) =>
            setEnemy({ armour: parseFloat(e.target.value) || 0 })
          }
        />
      </div>
      <div className="field">
        <span className="field__label">
          Armour Constant<span className="field__note"> [uncertain]</span>
        </span>
        <input
          className="num-input"
          type="number"
          min={1}
          value={enemy.armourConstant}
          onChange={(e) =>
            setEnemy({ armourConstant: parseFloat(e.target.value) || 10 })
          }
        />
      </div>
      <div className="field">
        <span className="field__label">+Phys Dmg Taken</span>
        <input
          className="num-input"
          type="number"
          value={enemy.increasedPhysicalDamageTaken}
          onChange={(e) =>
            setEnemy({
              increasedPhysicalDamageTaken: parseFloat(e.target.value) || 0,
            })
          }
        />
        <span className="field__suffix">%</span>
      </div>
      <p className="field__note">
        Pen cannot reduce resistance below 0%. Exposure/Weakness come from
        Toggles.
      </p>
    </Panel>
  );
}
