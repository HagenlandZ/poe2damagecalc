import { usePipeline } from "../../hooks/usePipeline";
import { DAMAGE_TYPES } from "../../calc/types";
import type { DamagePool, DamageType } from "../../calc/types";

const TYPE_LABELS: Record<DamageType, string> = {
  physical: "Physical",
  fire: "Fire",
  cold: "Cold",
  lightning: "Lightning",
  chaos: "Chaos",
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function PoolDisplay({ pool, barRef }: { pool: DamagePool; barRef?: number }) {
  const maxRef = barRef ?? Math.max(...DAMAGE_TYPES.map((t) => pool[t]), 1);
  const active = DAMAGE_TYPES.filter((t) => pool[t] > 0.5);
  if (active.length === 0)
    return <span className="field__note">— no damage —</span>;
  return (
    <div className="pool-display">
      {active.map((t) => {
        const pct = Math.min((pool[t] / maxRef) * 100, 100);
        return (
          <div key={t} className="pool-row">
            <span className={`dt-tag dt-tag--${t}`}>{TYPE_LABELS[t]}</span>
            <div className="pool-bar-wrap">
              <div
                className="pool-bar"
                style={{ width: `${pct}%`, backgroundColor: `var(--col-${t})` }}
              />
            </div>
            <span className="pool-value">{fmt(pool[t])}</span>
          </div>
        );
      })}
    </div>
  );
}

function StepHeader({ n, label }: { n: number; label: string }) {
  return (
    <div className="step-header">
      <span className="step-num">{n}</span>
      <span className="step-label">{label}</span>
    </div>
  );
}

function StepArrow({ text }: { text: string }) {
  return (
    <div className="step-arrow">
      <span>{text}</span>
    </div>
  );
}

export function PipelineBreakdown() {
  const { inputs, result, state } = usePipeline();

  const hasFlat = DAMAGE_TYPES.some((t) => inputs.addedFlat[t] > 0.5);
  const hasConversion = inputs.conversionRows.length > 0;

  // Reference for bar widths: pre-mitigation (highest un-reduced value)
  const barRef = Math.max(
    ...DAMAGE_TYPES.map((t) => result.preMitigation[t]),
    1,
  );

  const totalIncMult = (1 + inputs.totalIncreasedPercent / 100).toFixed(2);
  const moreMult = inputs.moreMultipliers.reduce(
    (acc, m) => acc * (1 + m.value / 100),
    1,
  );

  const enemy = inputs.enemy;

  // Per-type mitigation explanation
  const mitigationLines: string[] = [];
  for (const t of DAMAGE_TYPES) {
    if (result.preMitigation[t] < 0.5) continue;
    if (t === "physical") {
      if (enemy.armour > 0) {
        const arm = enemy.armour;
        const armConst = enemy.armourConstant;
        const dmg = result.preMitigation[t];
        const red = Math.min(arm / (arm + armConst * dmg), 0.9);
        mitigationLines.push(
          `Physical: ${arm} armour → ${(red * 100).toFixed(1)}% reduction → ×${(1 - red).toFixed(2)} taken`,
        );
      } else {
        mitigationLines.push("Physical: no armour");
      }
    } else {
      const base = enemy.resistances[t];
      const reduction = (enemy.reductions as Partial<DamagePool>)[t] ?? 0;
      const pen = (enemy.penetration as Partial<DamagePool>)[t] ?? 0;
      const afterReductions = base - reduction;
      const effective =
        afterReductions > 0
          ? Math.max(0, afterReductions - pen)
          : afterReductions;
      const taken = 1 - effective / 100;
      let desc = `${TYPE_LABELS[t]}: ${base}%`;
      if (reduction > 0) desc += ` − ${reduction}% reductions`;
      if (pen > 0 && afterReductions > 0) desc += ` − ${pen}% pen`;
      desc += ` = ${effective}% → ×${taken.toFixed(2)} taken`;
      mitigationLines.push(desc);
    }
  }

  return (
    <div className="breakdown">
      <div className="breakdown__title">PIPELINE — SINGLE HIT</div>

      {/* Step 1: Base Damage */}
      <div className="breakdown__step">
        <StepHeader n={1} label="Base Damage" />
        <PoolDisplay pool={inputs.baseDamage} barRef={barRef} />
      </div>

      {/* Step 2: Added Flat */}
      {hasFlat && (
        <>
          <StepArrow
            text={`+ added flat ×${state.addedDamageEffectiveness}% effectiveness`}
          />
          <div className="breakdown__step">
            <StepHeader n={2} label="After Flat" />
            <PoolDisplay pool={result.afterFlat} barRef={barRef} />
          </div>
        </>
      )}

      {/* Step 3: Conversion */}
      {hasConversion && (
        <>
          <StepArrow text="conversion / gain" />
          <div className="breakdown__step">
            <StepHeader n={hasFlat ? 3 : 2} label="After Conversion" />
            {inputs.conversionRows.map((r, i) => (
              <p key={i} className="field__note">
                {r.gainAsExtra
                  ? `${TYPE_LABELS[r.from]} +${r.percent}% as extra ${TYPE_LABELS[r.to]}`
                  : `${r.percent}% of ${TYPE_LABELS[r.from]} → ${TYPE_LABELS[r.to]}`}
                {r.skillInherent ? " (skill)" : ""}
              </p>
            ))}
            <PoolDisplay pool={result.afterConversion} barRef={barRef} />
          </div>
        </>
      )}

      {/* Scaling step */}
      <StepArrow
        text={
          `× ${totalIncMult} increased` +
          (inputs.moreMultipliers.length > 0
            ? " × " +
              inputs.moreMultipliers
                .map(
                  (m) =>
                    `${m.label || "More"} (×${(1 + m.value / 100).toFixed(2)})`,
                )
                .join(" × ")
            : "") +
          (moreMult > 1
            ? ` = ×${(parseFloat(totalIncMult) * moreMult).toFixed(2)} total`
            : "")
        }
      />
      <div className="breakdown__step">
        <StepHeader
          n={hasFlat && hasConversion ? 4 : hasFlat || hasConversion ? 3 : 2}
          label="After Scaling"
        />
        <div className="scaling-notes">
          <span>
            +{inputs.totalIncreasedPercent}% increased → ×{totalIncMult}
          </span>
          {inputs.moreMultipliers.map((m, i) => (
            <span key={i}>
              {m.label || "More"}: +{m.value}% → ×
              {(1 + m.value / 100).toFixed(2)}
            </span>
          ))}
        </div>
        <PoolDisplay pool={result.afterScaling} barRef={barRef} />
      </div>

      {/* Crit */}
      <StepArrow
        text={`× ${result.crit.expectedCritMultiplier.toFixed(3)} expected crit multiplier`}
      />
      <div className="breakdown__step">
        <StepHeader n={-1} label="Critical Strike" />
        <div className="crit-notes">
          <div className="crit-notes__row">
            <span>Effective Crit</span>
            <strong>
              {(result.crit.effectiveCritChance * 100).toFixed(1)}%
            </strong>
          </div>
          <div className="crit-notes__row">
            <span>Bonus on Crit</span>
            <strong>
              +{inputs.crit.criticalDamageBonus}% → ×
              {result.crit.critHitMultiplier.toFixed(2)}
            </strong>
          </div>
          <div className="crit-notes__row">
            <span>Expected ×</span>
            <strong className="accent">
              ×{result.crit.expectedCritMultiplier.toFixed(3)}
            </strong>
          </div>
        </div>
        <div className="step-sublabel">Pre-Mitigation (avg expected)</div>
        <PoolDisplay pool={result.preMitigation} barRef={barRef} />
      </div>

      {/* Mitigation */}
      <StepArrow text="enemy mitigation" />
      <div className="breakdown__step">
        <StepHeader n={-1} label="Enemy Mitigation" />
        {mitigationLines.map((line, i) => (
          <p key={i} className="field__note">
            {line}
          </p>
        ))}
      </div>

      {/* Final */}
      <div className="breakdown__step breakdown__step--final">
        <StepHeader n={-1} label="Final Hit" />
        <PoolDisplay pool={result.postMitigation} barRef={barRef} />
        <div className="total-hit">
          <span>TOTAL HIT</span>
          <strong>{fmt(result.totalHit)}</strong>
        </div>
        <div className="total-hit total-hit--nocrit">
          <span>No-crit hit</span>
          <span>{fmt(result.nonCritTotalHit)}</span>
        </div>
        {result.crit.effectiveCritChance > 0 && (
          <div className="total-hit total-hit--crit">
            <span>Full crit hit</span>
            <span>
              {fmt(result.nonCritTotalHit * result.crit.critHitMultiplier)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
