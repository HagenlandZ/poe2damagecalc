import { useDamageStore } from "../../store/damageStore";
import { Panel } from "../shared/Panel";
import { NumInput } from "../shared/NumInput";
import { calcCrit } from "../../calc/pipeline";

export function CritPanel() {
  const crit = useDamageStore((s) => s.crit);
  const setCrit = useDamageStore((s) => s.setCrit);

  const result = calcCrit(crit);
  const effectivePct = (result.effectiveCritChance * 100).toFixed(1);
  const expectedMult = result.expectedCritMultiplier.toFixed(3);

  return (
    <Panel title="Critical Strike">
      <NumInput
        label="Base Crit Chance"
        value={crit.baseCritChance}
        onChange={(v) => setCrit({ baseCritChance: v })}
        min={0}
        max={100}
        step={0.1}
        suffix="%"
      />
      <NumInput
        label="Flat Added Base Crit"
        value={crit.flatAddedBaseCrit}
        onChange={(v) => setCrit({ flatAddedBaseCrit: v })}
        min={0}
        max={100}
        step={0.1}
        suffix="%"
      />
      <NumInput
        label="Increased Crit Chance"
        value={crit.increasedCritChance}
        onChange={(v) => setCrit({ increasedCritChance: v })}
        min={0}
        suffix="%"
      />
      <NumInput
        label="Crit Damage Bonus"
        value={crit.criticalDamageBonus}
        onChange={(v) => setCrit({ criticalDamageBonus: v })}
        min={0}
        suffix="%"
        note="default 100 → crits deal 200%"
      />

      <div className="computed-block">
        <div className="computed-row">
          <span>Effective Crit</span>
          <strong>{effectivePct}%</strong>
        </div>
        <div className="computed-row">
          <span>Crit Hit Multiplier</span>
          <strong>×{result.critHitMultiplier.toFixed(2)}</strong>
        </div>
        <div className="computed-row">
          <span>Expected ×</span>
          <strong className="accent">×{expectedMult}</strong>
        </div>
      </div>
    </Panel>
  );
}
