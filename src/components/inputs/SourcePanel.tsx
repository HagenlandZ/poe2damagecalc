import { useDamageStore } from "../../store/damageStore";
import { Panel } from "../shared/Panel";
import type { SourceKind } from "../../calc/types";

export function SourcePanel() {
  const source = useDamageStore((s) => s.source);
  const setSource = useDamageStore((s) => s.setSource);

  return (
    <Panel title="Source">
      <div className="toggle-row">
        {(["attack", "spell"] as SourceKind[]).map((s) => (
          <button
            key={s}
            className={`source-btn ${source === s ? "source-btn--active" : ""}`}
            onClick={() => setSource(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <p className="field__note" style={{ marginTop: "0.5rem" }}>
        {source === "attack"
          ? "Base damage from weapon min/max. Weapon crit chance applies."
          : "Base damage from skill gem level. Skill crit chance applies."}
      </p>
    </Panel>
  );
}
