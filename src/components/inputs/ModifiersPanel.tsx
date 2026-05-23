import { useDamageStore } from "../../store/damageStore";
import { Panel } from "../shared/Panel";
import type { MoreMultiplier } from "../../calc/pipeline";

export function ModifiersPanel() {
  const increasedEntries = useDamageStore((s) => s.increasedEntries);
  const moreMultipliers = useDamageStore((s) => s.moreMultipliers);
  const setIncreasedEntries = useDamageStore((s) => s.setIncreasedEntries);
  const setMoreMultipliers = useDamageStore((s) => s.setMoreMultipliers);

  const totalIncreased = increasedEntries.reduce((s, e) => s + e.value, 0);

  const updateIncreased = (
    i: number,
    patch: Partial<{ label: string; value: number }>,
  ) =>
    setIncreasedEntries(
      increasedEntries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );

  const removeIncreased = (i: number) =>
    setIncreasedEntries(increasedEntries.filter((_, idx) => idx !== i));

  const updateMore = (i: number, patch: Partial<MoreMultiplier>) =>
    setMoreMultipliers(
      moreMultipliers.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    );

  const removeMore = (i: number) =>
    setMoreMultipliers(moreMultipliers.filter((_, idx) => idx !== i));

  return (
    <Panel title="Modifiers">
      {/* Increased / Reduced (additive pool) */}
      <div className="subsection-label">
        Increased Damage{" "}
        <span className="badge">
          additive pool — total: +{totalIncreased}% → ×
          {(1 + totalIncreased / 100).toFixed(2)}
        </span>
      </div>
      {increasedEntries.map((entry, i) => (
        <div key={i} className="list-row">
          <input
            className="text-input"
            type="text"
            value={entry.label}
            placeholder="Label"
            onChange={(e) => updateIncreased(i, { label: e.target.value })}
          />
          <input
            className="num-input"
            type="number"
            value={entry.value}
            onChange={(e) =>
              updateIncreased(i, { value: parseFloat(e.target.value) || 0 })
            }
          />
          <span className="field__suffix">%</span>
          <button
            className="btn btn--remove btn--sm"
            onClick={() => removeIncreased(i)}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        className="btn btn--add"
        onClick={() =>
          setIncreasedEntries([...increasedEntries, { label: "", value: 0 }])
        }
      >
        + Add
      </button>

      {/* More multipliers (each separate) */}
      <div className="subsection-label" style={{ marginTop: "0.75rem" }}>
        More Damage <span className="badge">each is a separate multiplier</span>
      </div>
      {moreMultipliers.length === 0 && (
        <p className="field__note">No more multipliers applied.</p>
      )}
      {moreMultipliers.map((m, i) => (
        <div key={i} className="list-row">
          <input
            className="text-input"
            type="text"
            value={m.label}
            placeholder="Label (e.g. Support)"
            onChange={(e) => updateMore(i, { label: e.target.value })}
          />
          <input
            className="num-input"
            type="number"
            value={m.value}
            onChange={(e) =>
              updateMore(i, { value: parseFloat(e.target.value) || 0 })
            }
          />
          <span className="field__suffix">%</span>
          <button
            className="btn btn--remove btn--sm"
            onClick={() => removeMore(i)}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        className="btn btn--add"
        onClick={() =>
          setMoreMultipliers([...moreMultipliers, { label: "", value: 0 }])
        }
      >
        + Add
      </button>
    </Panel>
  );
}
