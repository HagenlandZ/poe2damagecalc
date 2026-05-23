import { useDamageStore } from "../../store/damageStore";
import { Panel } from "../shared/Panel";
import { DAMAGE_TYPES } from "../../calc/types";
import type { DamageType } from "../../calc/types";
import type { ConversionRow } from "../../calc/pipeline";

const TYPE_LABELS: Record<DamageType, string> = {
  physical: "Physical",
  fire: "Fire",
  cold: "Cold",
  lightning: "Lightning",
  chaos: "Chaos",
};

const emptyRow = (): ConversionRow => ({
  from: "physical",
  to: "fire",
  percent: 50,
  gainAsExtra: false,
  skillInherent: false,
});

export function ConversionPanel() {
  const rows = useDamageStore((s) => s.conversionRows);
  const setConversionRows = useDamageStore((s) => s.setConversionRows);

  const update = (i: number, patch: Partial<ConversionRow>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setConversionRows(next);
  };

  const remove = (i: number) =>
    setConversionRows(rows.filter((_, idx) => idx !== i));

  const add = () => setConversionRows([...rows, emptyRow()]);

  return (
    <Panel title="Conversion & Gain">
      {rows.length === 0 && (
        <p className="field__note">
          No conversion rows. Damage passes through unchanged.
        </p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="conv-row">
          <div className="conv-row__selects">
            <select
              className="select-input"
              value={row.from}
              onChange={(e) =>
                update(i, { from: e.target.value as DamageType })
              }
            >
              {DAMAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <span className="conv-arrow">{row.gainAsExtra ? "+" : "→"}</span>
            <select
              className="select-input"
              value={row.to}
              onChange={(e) => update(i, { to: e.target.value as DamageType })}
            >
              {DAMAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              className="num-input num-input--sm"
              type="number"
              min={0}
              max={100}
              value={row.percent}
              onChange={(e) =>
                update(i, { percent: parseFloat(e.target.value) || 0 })
              }
            />
            <span className="field__suffix">%</span>
          </div>
          <div className="conv-row__flags">
            <label className="check-label">
              <input
                type="checkbox"
                checked={row.gainAsExtra}
                onChange={(e) => update(i, { gainAsExtra: e.target.checked })}
              />
              Gain
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={row.skillInherent}
                onChange={(e) => update(i, { skillInherent: e.target.checked })}
              />
              Skill
            </label>
            <button
              className="btn btn--remove btn--sm"
              onClick={() => remove(i)}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <button
        className="btn btn--add"
        style={{ marginTop: "0.5rem" }}
        onClick={add}
      >
        + Add Row
      </button>
      <p className="field__note" style={{ marginTop: "0.4rem" }}>
        "Gain" = adds extra without removing source. "Skill" = applied before
        other conversions.
      </p>
    </Panel>
  );
}
