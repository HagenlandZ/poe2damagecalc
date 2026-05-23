import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { usePipeline } from "../../hooks/usePipeline";
import {
  sweepVariable,
  getCurrentSweepValue,
  SWEEP_VARIABLE_LABELS,
  SWEEP_RANGES,
} from "../../calc/selectors";
import type { SweepVariable } from "../../calc/selectors";

const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;

export function ScalingChart() {
  const { inputs } = usePipeline();
  const [variable, setVariable] = useState<SweepVariable>("totalIncreased");
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useMemo(
    () => sweepVariable(inputs, variable, 100),
    [inputs, variable],
  );
  const currentX = useMemo(
    () => getCurrentSweepValue(inputs, variable),
    [inputs, variable],
  );

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    if (width === 0) return;

    const height = 230;
    const margin = { top: 16, right: 24, bottom: 32, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const [xMin, xMax] = SWEEP_RANGES[variable];
    const yMax = d3.max(data, (d) => d.y) ?? 1;

    const x = d3.scaleLinear().domain([xMin, xMax]).range([0, innerW]);
    const y = d3
      .scaleLinear()
      .domain([0, yMax * 1.08])
      .range([innerH, 0]);

    // Gridlines
    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-innerW)
          .tickFormat(() => ""),
      )
      .select(".domain")
      .remove();

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6))
      .selectAll("text")
      .style("fill", "#888")
      .style("font-size", "11px");

    // Y axis
    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => fmt(d as number)),
      )
      .selectAll("text")
      .style("fill", "#888")
      .style("font-size", "11px");

    // Remove axis lines
    g.selectAll(".domain").style("stroke", "#333");
    g.selectAll(".grid line")
      .style("stroke", "#222")
      .style("stroke-dasharray", "3,3");

    // Area under curve
    const area = d3
      .area<{ x: number; y: number }>()
      .x((d) => x(d.x))
      .y0(innerH)
      .y1((d) => y(d.y))
      .curve(d3.curveCatmullRom.alpha(0.5));

    g.append("path")
      .datum(data)
      .attr("fill", "rgba(200,169,110,0.08)")
      .attr("d", area);

    // Main line
    const line = d3
      .line<{ x: number; y: number }>()
      .x((d) => x(d.x))
      .y((d) => y(d.y))
      .curve(d3.curveCatmullRom.alpha(0.5));

    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "var(--accent)")
      .attr("stroke-width", 2)
      .attr("d", line);

    // Current value marker
    const clamped = Math.max(xMin, Math.min(xMax, currentX));
    const closest = data.reduce((a, b) =>
      Math.abs(b.x - clamped) < Math.abs(a.x - clamped) ? b : a,
    );

    // Vertical dashed line
    g.append("line")
      .attr("x1", x(clamped))
      .attr("x2", x(clamped))
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", "rgba(255,255,255,0.25)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,3");

    // Dot
    g.append("circle")
      .attr("cx", x(clamped))
      .attr("cy", y(closest.y))
      .attr("r", 5)
      .attr("fill", "var(--accent)")
      .attr("stroke", "#0d0d0d")
      .attr("stroke-width", 2);

    // Value label (flip side if near right edge)
    const labelX = x(clamped) + (clamped > (xMin + xMax) * 0.75 ? -8 : 8);
    const anchor = clamped > (xMin + xMax) * 0.75 ? "end" : "start";
    g.append("text")
      .attr("x", labelX)
      .attr("y", y(closest.y) - 10)
      .attr("fill", "var(--accent)")
      .attr("font-size", "11px")
      .attr("text-anchor", anchor)
      .text(Math.round(closest.y).toLocaleString("en-US"));

    // X-axis label
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 28)
      .attr("fill", "#666")
      .attr("font-size", "11px")
      .attr("text-anchor", "middle")
      .text(SWEEP_VARIABLE_LABELS[variable]);
  }, [data, currentX, variable]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <div className="panel">
      <div className="panel__header">SCALING GRAPH</div>
      <div className="panel__body">
        <div className="field">
          <span className="field__label">Sweep variable</span>
          <select
            className="select-input"
            value={variable}
            onChange={(e) => setVariable(e.target.value as SweepVariable)}
          >
            {(
              Object.entries(SWEEP_VARIABLE_LABELS) as [SweepVariable, string][]
            ).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div ref={containerRef} style={{ width: "100%" }}>
          <svg ref={svgRef} style={{ display: "block", overflow: "visible" }} />
        </div>
        <p className="field__note" style={{ marginTop: "0.4rem" }}>
          All other inputs held constant. Circle = current value.
        </p>
      </div>
    </div>
  );
}
