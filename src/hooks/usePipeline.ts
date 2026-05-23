import { useMemo } from "react";
import { useDamageStore } from "../store/damageStore";
import { buildHitInputs } from "../calc/selectors";
import { runPipeline } from "../calc/pipeline";

export function usePipeline() {
  const state = useDamageStore();
  const inputs = useMemo(() => buildHitInputs(state), [state]);
  const result = useMemo(() => runPipeline(inputs), [inputs]);
  return { inputs, result, state };
}
