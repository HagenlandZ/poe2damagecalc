import { useDamageStore } from "../../store/damageStore";
import { Panel } from "../shared/Panel";
import type { Toggles } from "../../store/damageStore";

const TOGGLE_CONFIG: { key: keyof Toggles; label: string; note: string }[] = [
  {
    key: "elementalFocus",
    label: "Elemental Focus",
    note: "+25% more elemental damage, cannot inflict elemental ailments",
  },
  {
    key: "concentratedArea",
    label: "Concentrated Area",
    note: "+30% more area damage, −50% AoE size",
  },
  {
    key: "exposureActive",
    label: "Exposure",
    note: "−20% elemental resistance on enemy",
  },
  {
    key: "elementalWeaknessActive",
    label: "Elemental Weakness",
    note: "−30% elemental resistance on enemy",
  },
];

export function TogglesPanel() {
  const toggles = useDamageStore((s) => s.toggles);
  const setToggle = useDamageStore((s) => s.setToggle);

  return (
    <Panel title="Toggles">
      {TOGGLE_CONFIG.map(({ key, label, note }) => (
        <label key={key} className="toggle-check">
          <input
            type="checkbox"
            checked={toggles[key]}
            onChange={(e) => setToggle(key, e.target.checked)}
          />
          <span>
            <span className="toggle-check__label">{label}</span>
            <span className="field__note"> — {note}</span>
          </span>
        </label>
      ))}
    </Panel>
  );
}
