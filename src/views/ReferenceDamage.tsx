import { SourcePanel } from "../components/inputs/SourcePanel";
import { BaseDamagePanel } from "../components/inputs/BaseDamagePanel";
import { ConversionPanel } from "../components/inputs/ConversionPanel";
import { ModifiersPanel } from "../components/inputs/ModifiersPanel";
import { CritPanel } from "../components/inputs/CritPanel";
import { TogglesPanel } from "../components/inputs/TogglesPanel";
import { EnemyPanel } from "../components/inputs/EnemyPanel";
import { PipelineBreakdown } from "../components/output/PipelineBreakdown";
import { ScalingChart } from "../components/charts/ScalingChart";

export function ReferenceDamage() {
  return (
    <main className="stage1">
      <div className="stage1__inputs">
        <SourcePanel />
        <BaseDamagePanel />
        <ConversionPanel />
        <ModifiersPanel />
        <CritPanel />
        <TogglesPanel />
        <EnemyPanel />
      </div>
      <div className="stage1__output">
        <PipelineBreakdown />
        <ScalingChart />
      </div>
    </main>
  );
}
