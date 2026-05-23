import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import { useDragScrubber } from "../hooks/useDragScrubber";

// ---------------------------------------------------------------------------
// Types & defaults
// ---------------------------------------------------------------------------

interface Inputs {
  baseDamage: number;
  extraPct: number;
  increasedPct: number;
  critChancePct: number;
  critBonusPct: number;
  morePct: number;
}

const DEFAULTS: Inputs = {
  baseDamage: 1000,
  extraPct: 30,
  increasedPct: 50,
  critChancePct: 50,
  critBonusPct: 200,
  morePct: 35,
};

const LIFE_OPTIONS = [
  { label: "10k", value: 10_000 },
  { label: "100k", value: 100_000 },
  { label: "1M", value: 1_000_000 },
  { label: "10M", value: 10_000_000 },
  { label: "100M", value: 100_000_000 },
  { label: "1B", value: 1_000_000_000 },
];

// height of the handles zone above the bar
const HANDLES_HEIGHT = 92;

const LS_KEY = "dd-inp";
const LS_KEY_ENEMY = "dd-enemy";

// ---------------------------------------------------------------------------
// Enemy / ailment inputs
// ---------------------------------------------------------------------------

interface EnemyInputs {
  enabled: boolean;
  resistance: number; // enemy elemental resistance (0–75)
  penetration: number; // your penetration (0–100)
  exposureEnabled: boolean;
  exposure: number; // exposure penalty (0–50)
  curseEnabled: boolean;
  curseRes: number; // lower-resistance curse (0–60)
  shockEnabled: boolean;
  shockEffect: number; // base shock effect % (% increased damage taken), default 20
  shockMagnitude: number; // +% increased shock magnitude (scales shockEffect), default 0
  rakiataEnabled: boolean; // Rakiata's Flow: inverts enemy resistance
}

const ENEMY_DEFAULTS: EnemyInputs = {
  enabled: false,
  resistance: 0,
  penetration: 0,
  exposureEnabled: false,
  exposure: 10,
  curseEnabled: false,
  curseRes: 20,
  shockEnabled: false,
  shockEffect: 20,
  shockMagnitude: 0,
  rakiataEnabled: false,
};

interface EnemyResult {
  afterRes: number; // damage after resistance, before shock
  dealt: number; // final damage (after shock)
  effectiveRes: number; // clamped effective resistance (can be negative)
  shockBonus: number; // absolute shock bonus on top of afterRes
}

function computeEnemy(raw: number, enemy: EnemyInputs): EnemyResult {
  if (!enemy.enabled) {
    return { afterRes: raw, dealt: raw, effectiveRes: 0, shockBonus: 0 };
  }
  const totalReduction =
    enemy.penetration +
    (enemy.exposureEnabled ? enemy.exposure : 0) +
    (enemy.curseEnabled ? enemy.curseRes : 0);
  const baseRes = enemy.rakiataEnabled ? -enemy.resistance : enemy.resistance;
  const effectiveRes = Math.max(-100, baseRes - totalReduction);
  const resMult = 1 - effectiveRes / 100;
  const afterRes = raw * resMult;
  const finalShockEffect = enemy.shockEffect * (1 + enemy.shockMagnitude / 100);
  const shockMult = enemy.shockEnabled ? 1 + finalShockEffect / 100 : 1;
  const dealt = afterRes * shockMult;
  return { afterRes, dealt, effectiveRes, shockBonus: dealt - afterRes };
}

// signed-delta formatters used in change history
const signedPct = (d: number) => `${d >= 0 ? "+" : ""}${Math.round(d)}%`;
const signedAbs = (d: number) =>
  `${d >= 0 ? "+" : ""}${Math.round(d).toLocaleString("en-US")}`;

// metadata for each draggable field
const FIELD_META = {
  baseDamage: {
    label: "Base Damage",
    color: "#8898aa",
    fmt: (v: number) => Math.round(v).toLocaleString("en-US"),
    fmtDiff: signedAbs,
  },
  extraPct: {
    label: "Extra Damage",
    color: "#2e7d52",
    fmt: (v: number) => `+${Math.round(v)}%`,
    fmtDiff: signedPct,
  },
  increasedPct: {
    label: "Increased Damage",
    color: "#1e5ea8",
    fmt: (v: number) => `+${Math.round(v)}%`,
    fmtDiff: signedPct,
  },
  morePct: {
    label: "More Damage",
    color: "#b8420e",
    fmt: (v: number) => `+${Math.round(v)}%`,
    fmtDiff: signedPct,
  },
  critChancePct: {
    label: "Critical Hit Chance",
    color: "#c06820",
    fmt: (v: number) => `${Math.round(v)}%`,
    fmtDiff: signedPct,
  },
  critBonusPct: {
    label: "Critical Hit Bonus",
    color: "#e0b030",
    fmt: (v: number) => `+${Math.round(v)}%`,
    fmtDiff: signedPct,
  },
} satisfies Record<
  keyof Inputs,
  {
    label: string;
    color: string;
    fmt: (v: number) => string;
    fmtDiff: (d: number) => string;
  }
>;

interface HistoryEntry {
  total: number;
  totalDiff: number;
  diff: string;
  label: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

interface Section {
  key: string;
  name: string;
  color: string;
  contrib: number;
}

function computeSimple(inp: Inputs): { sections: Section[]; total: number } {
  const s0 = Math.max(0, inp.baseDamage);
  const s1 = s0 * (1 + Math.max(0, inp.extraPct) / 100);
  const s2 = s1 * (1 + Math.max(0, inp.increasedPct) / 100);
  const s3 = s2 * (1 + Math.max(0, inp.morePct) / 100);
  const critMult =
    1 +
    (Math.min(100, Math.max(0, inp.critChancePct)) / 100) *
      (Math.max(0, inp.critBonusPct) / 100);
  const s4 = s3 * critMult;
  const total = Math.max(s4, 1);

  const critTotal = s4 - s3;
  const critSum = inp.critChancePct + inp.critBonusPct;
  const critChanceContrib =
    critSum > 0 ? (critTotal * inp.critChancePct) / critSum : critTotal * 0.5;
  const critBonusContrib = critTotal - critChanceContrib;

  return {
    total,
    sections: [
      { key: "base", name: "Base", color: "#607080", contrib: s0 },
      {
        key: "extra",
        name: "Extra Damage",
        color: "#2e7d52",
        contrib: s1 - s0,
      },
      {
        key: "increased",
        name: "Increased Damage",
        color: "#1e5ea8",
        contrib: s2 - s1,
      },
      { key: "more", name: "More Damage", color: "#b8420e", contrib: s3 - s2 },
      {
        key: "crit-chance",
        name: "Critical Hit Chance",
        color: "#c06820",
        contrib: critChanceContrib,
      },
      {
        key: "crit-bonus",
        name: "Critical Hit Bonus",
        color: "#e0b030",
        contrib: critBonusContrib,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function fmtLarge(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toString();
}

function fmtAxis(n: number): string {
  if (n >= 1e9) return `${n / 1e9}B`;
  if (n >= 1e6) return `${n / 1e6}M`;
  if (n >= 1e3) return `${n / 1e3}k`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Scrubber — inline drag-to-change value, used in the enemy panel
// ---------------------------------------------------------------------------

interface ScrubberProps {
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number, prev: number) => void;
  format: (v: number) => string;
  sensitivity?: number;
  min?: number;
  max?: number;
  color?: string;
}

function Scrubber({
  value,
  onChange,
  onCommit,
  format,
  sensitivity = 0.5,
  min = 0,
  max = 100,
  color,
}: ScrubberProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const startValueRef = useRef(value);
  const { onMouseDown, isDragging } = useDragScrubber({
    value,
    onChange,
    onCommit,
    sensitivity,
    min,
    max,
  });

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    startValueRef.current = value;
    setDraft(String(Math.round(value * 10) / 10));
    setEditing(true);
  };

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n)) {
      const clamped = Math.max(min, Math.min(max, n));
      onChange(clamped);
      onCommit?.(clamped, startValueRef.current);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className="s-scrub-input"
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className={`e-scrub-val${isDragging ? " e-scrub-val--drag" : ""}`}
      style={color ? { color } : undefined}
      onMouseDown={onMouseDown}
      onDoubleClick={startEdit}
      title="Drag ↔ · double-click to type"
    >
      {format(value)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DragHandle — circle on a vertical line at section boundary, drag ↔
// ---------------------------------------------------------------------------

interface DragHandleProps {
  x: number; // left % within .s-handles
  lineH: number; // line height px
  value: number;
  format: (v: number) => string;
  label: string;
  onChange: (v: number) => void;
  onCommit?: (v: number, prev: number) => void;
  sensitivity: number;
  min: number;
  max: number;
  color: string;
  labelOnLeft?: boolean;
}

function DragHandle({
  x,
  lineH,
  value,
  format,
  label,
  onChange,
  onCommit,
  sensitivity,
  min,
  max,
  color,
  labelOnLeft = false,
}: DragHandleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const startValueRef = useRef(value);
  const { onMouseDown, isDragging } = useDragScrubber({
    value,
    onChange,
    onCommit,
    sensitivity,
    min,
    max,
  });

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    startValueRef.current = value;
    setDraft(String(Math.round(value * 10) / 10));
    setEditing(true);
  };

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n)) {
      const clamped = Math.max(min, Math.min(max, n));
      onChange(clamped);
      onCommit?.(clamped, startValueRef.current);
    }
    setEditing(false);
  };

  return (
    <div className="s-handle" style={{ left: `${x}%`, height: lineH }}>
      <div className="s-handle__line" style={{ backgroundColor: color }} />
      <div
        className={`s-handle__circle${isDragging ? " s-handle__circle--drag" : ""}`}
        style={{ backgroundColor: color }}
        onMouseDown={onMouseDown}
        onDoubleClick={startEdit}
        title="Drag ↔ · double-click to type"
      />
      {editing ? (
        <input
          className={`s-scrub-input s-handle__input${labelOnLeft ? " s-handle__input--left" : ""}`}
          autoFocus
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <span
          className={`s-handle__label${labelOnLeft ? " s-handle__label--left" : ""}`}
          style={{ color }}
        >
          {format(value)} {label}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SimpleDamage() {
  const [inp, setInp] = useState<Inputs>(() => {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (s) return { ...DEFAULTS, ...(JSON.parse(s) as Inputs) };
    } catch {
      /* ignore */
    }
    return DEFAULTS;
  });
  const [targetLife, setTargetLife] = useState(10_000);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [enemy, setEnemy] = useState<EnemyInputs>(() => {
    try {
      const s = localStorage.getItem(LS_KEY_ENEMY);
      if (s) return { ...ENEMY_DEFAULTS, ...(JSON.parse(s) as EnemyInputs) };
    } catch {
      /* ignore */
    }
    return ENEMY_DEFAULTS;
  });
  const [enemyOpen, setEnemyOpen] = useState(() => {
    try {
      const s = localStorage.getItem(LS_KEY_ENEMY);
      if (s) return (JSON.parse(s) as EnemyInputs).enabled === true;
    } catch {
      /* ignore */
    }
    return false;
  });
  const [resistancePreset, setResistancePreset] = useState("");

  const setEnemyField = <K extends keyof EnemyInputs>(
    k: K,
    v: EnemyInputs[K],
  ) => setEnemy((prev) => ({ ...prev, [k]: v }));

  const inpRef = useRef(inp);
  inpRef.current = inp;
  const enemyRef = useRef(enemy);
  enemyRef.current = enemy;

  const setField = (field: keyof Inputs, v: number) =>
    setInp((prev) => ({ ...prev, [field]: v }));

  const handleCommit = useCallback(
    (field: keyof Inputs, value: number, prevValue: number) => {
      if (value === prevValue) return;
      const meta = FIELD_META[field];
      const delta = value - prevValue;
      const rawPrev = computeSimple({
        ...inpRef.current,
        [field]: prevValue,
      }).total;
      const rawNew = computeSimple({ ...inpRef.current, [field]: value }).total;
      const prevDealt = computeEnemy(rawPrev, enemyRef.current).dealt;
      const newDealt = computeEnemy(rawNew, enemyRef.current).dealt;
      setHistory((prev) =>
        [
          {
            total: newDealt,
            totalDiff: newDealt - prevDealt,
            diff: meta.fmtDiff(delta),
            label: meta.label,
            color: meta.color,
          },
          ...prev,
        ].slice(0, 5),
      );
    },
    [],
  );

  const handleEnemyCommit = useCallback(
    (
      prevEnemy: EnemyInputs,
      newEnemy: EnemyInputs,
      diff: string,
      label: string,
      color: string,
    ) => {
      if (!newEnemy.enabled) return;
      const rawTotal = computeSimple(inpRef.current).total;
      const prevDealt = computeEnemy(rawTotal, prevEnemy).dealt;
      const newDealt = computeEnemy(rawTotal, newEnemy).dealt;
      const totalDiff = newDealt - prevDealt;
      if (Math.round(Math.abs(totalDiff)) === 0) return;
      setHistory((prev) =>
        [{ total: newDealt, totalDiff, diff, label, color }, ...prev].slice(
          0,
          5,
        ),
      );
    },
    [],
  );

  const resetState = useCallback(() => {
    setInp(DEFAULTS);
    setEnemy(ENEMY_DEFAULTS);
    setHistory([]);
    setTargetLife(10_000);
    setResistancePreset("");
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_KEY_ENEMY);
  }, []);

  const { sections, total } = useMemo(() => computeSimple(inp), [inp]);
  const enemyResult = useMemo(() => computeEnemy(total, enemy), [total, enemy]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(inp));
  }, [inp]);

  useEffect(() => {
    localStorage.setItem(LS_KEY_ENEMY, JSON.stringify(enemy));
  }, [enemy]);

  // Dynamic axis max: keep damage marker at ~4/5 of the log axis, min 10M
  const maxRef = useMemo(() => {
    const logTarget = Math.log10(Math.max(total, 1)) * 1.25;
    const pow = Math.pow(10, Math.ceil(logTarget));
    return Math.max(pow, 10_000_000);
  }, [total]);

  // Bar width as fraction of container (log scale)
  const barFraction = useMemo(
    () =>
      Math.min(
        Math.max(Math.log10(Math.max(total, 1)) / Math.log10(maxRef), 0),
        1,
      ),
    [total, maxRef],
  );

  // Cumulative left positions for labels (% within the bar)
  const cumLeftPcts = useMemo(() => {
    const pcts: number[] = [];
    let cum = 0;
    for (const s of sections) {
      pcts.push((cum / total) * 100);
      cum += s.contrib;
    }
    return pcts;
  }, [sections, total]);

  // Part 2: compare section — scale all endpoints relative to max
  const { afterRes, dealt, effectiveRes, shockBonus } = enemyResult;
  const compareMax = Math.max(dealt, targetLife);
  const rawEndPct = (total / compareMax) * 100;
  const dealtEndPct = (afterRes / compareMax) * 100;
  const shockEndPct = (dealt / compareMax) * 100;
  const lifePct = (targetLife / compareMax) * 100;

  // D3 log-scale axis
  const containerRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<SVGSVGElement>(null);

  const drawAxis = useCallback(() => {
    if (!axisRef.current || !containerRef.current) return;
    const W = containerRef.current.clientWidth;
    if (W === 0) return;
    const H = 38;

    const svg = d3.select(axisRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", W).attr("height", H);

    const scale = d3.scaleLog().domain([1, maxRef]).range([0, W]);
    const ticks = [
      1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000,
      1_000_000_000,
    ].filter((t) => t <= maxRef * 1.1);

    // Baseline
    svg
      .append("line")
      .attr("x1", 0)
      .attr("x2", W)
      .attr("y1", 6)
      .attr("y2", 6)
      .attr("stroke", "#484848");

    ticks.forEach((tick) => {
      const x = scale(tick);
      svg
        .append("line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", 3)
        .attr("y2", 10)
        .attr("stroke", "#585858");
      svg
        .append("text")
        .attr("x", x)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .attr("fill", "#888")
        .attr("font-size", "10px")
        .text(fmtAxis(tick));
    });

    // Current value marker (triangle + line)
    const cx = Math.min(scale(Math.max(total, 1)), W);
    svg
      .append("line")
      .attr("x1", cx)
      .attr("x2", cx)
      .attr("y1", 0)
      .attr("y2", 13)
      .attr("stroke", "var(--accent)")
      .attr("stroke-width", 2);
    svg
      .append("polygon")
      .attr("points", `${cx - 5},0 ${cx + 5},0 ${cx},7`)
      .attr("fill", "var(--accent)");
  }, [total, maxRef]);

  useEffect(() => {
    drawAxis();
  }, [drawAxis]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => drawAxis());
    ro.observe(el);
    return () => ro.disconnect();
  }, [drawAxis]);

  return (
    <div className="simple-page">
      <div className="s-top-bar">
        <span className="simple-hint">
          Drag the circles ↔ to change values · double-click to type
        </span>
        <button className="s-reset-btn" onClick={resetState}>
          Reset
        </button>
      </div>

      {/* ── Part 1: damage pipeline bar ─────────────────────────────── */}
      <div ref={containerRef} className="s-container">
        <div className="s-bar-area">
          <div
            className="s-bar-wrap"
            style={{ width: `${barFraction * 100}%` }}
          >
            {/* ── Drag handles above the bar ── */}
            <div className="s-handles" style={{ height: HANDLES_HEIGHT }}>
              {/* Heights ascend left→right: 14 / 28 / 42 / 56 / 70 / 84 — each label clears the one below */}
              <DragHandle
                x={cumLeftPcts[1]}
                lineH={14}
                value={inp.baseDamage}
                format={(v) => Math.round(v).toLocaleString("en-US")}
                label="Base"
                onChange={(v) => setField("baseDamage", v)}
                onCommit={(v, prev) => handleCommit("baseDamage", v, prev)}
                sensitivity={5}
                min={0}
                max={1_000_000}
                color="#607080"
                labelOnLeft
              />
              <DragHandle
                x={cumLeftPcts[2]}
                lineH={28}
                value={inp.extraPct}
                format={(v) => `+${Math.round(v)}%`}
                label="Extra Damage"
                onChange={(v) => setField("extraPct", v)}
                onCommit={(v, prev) => handleCommit("extraPct", v, prev)}
                sensitivity={0.3}
                min={0}
                max={500}
                color="#2e7d52"
                labelOnLeft
              />
              <DragHandle
                x={cumLeftPcts[3]}
                lineH={42}
                value={inp.increasedPct}
                format={(v) => `+${Math.round(v)}%`}
                label="Increased Damage"
                onChange={(v) => setField("increasedPct", v)}
                onCommit={(v, prev) => handleCommit("increasedPct", v, prev)}
                sensitivity={0.5}
                min={0}
                max={2000}
                color="#1e5ea8"
                labelOnLeft
              />
              <DragHandle
                x={cumLeftPcts[4]}
                lineH={56}
                value={inp.morePct}
                format={(v) => `+${Math.round(v)}%`}
                label="More Damage"
                onChange={(v) => setField("morePct", v)}
                onCommit={(v, prev) => handleCommit("morePct", v, prev)}
                sensitivity={0.3}
                min={0}
                max={2000}
                color="#b8420e"
                labelOnLeft
              />
              <DragHandle
                x={cumLeftPcts[5]}
                lineH={70}
                value={inp.critChancePct}
                format={(v) => `${Math.round(v)}%`}
                label="Critical Hit Chance"
                onChange={(v) => setField("critChancePct", v)}
                onCommit={(v, prev) => handleCommit("critChancePct", v, prev)}
                sensitivity={0.3}
                min={0}
                max={100}
                color="#c06820"
                labelOnLeft
              />
              <DragHandle
                x={100}
                lineH={84}
                value={inp.critBonusPct}
                format={(v) => `+${Math.round(v)}%`}
                label="Critical Hit Bonus"
                onChange={(v) => setField("critBonusPct", v)}
                onCommit={(v, prev) => handleCommit("critBonusPct", v, prev)}
                sensitivity={1}
                min={0}
                max={2000}
                color="#e0b030"
                labelOnLeft
              />
            </div>

            {/* ── Coloured segments ── */}
            <div className="s-bar">
              {sections.map((s) => (
                <div
                  key={s.key}
                  className="s-seg"
                  style={{
                    flex: Math.max(s.contrib, 0.001),
                    backgroundColor: s.color,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* History: current total + last 5 committed changes */}
        <div className="s-history">
          <div className="s-history__row">
            <span className="s-history__num">
              {fmtLarge(enemy.enabled ? dealt : total)}
            </span>
            <span className="s-history__sep">|</span>
            <span className="s-history__label">
              {enemy.enabled ? "Damage Dealt" : "Total Damage"}
            </span>
          </div>
          {history.map((h, i) => (
            <div key={i} className="s-history__row">
              <span className="s-history__num s-history__num--muted">
                {fmtLarge(h.total)}
              </span>
              <span className="s-history__sep">|</span>
              <span className="s-history__label">
                (
                <span style={{ color: h.color }}>
                  {h.diff} {h.label}
                </span>
                ) <span className="s-history__sep">— </span>
                <span style={{ color: "#fff" }}>Damage: </span>
                <span
                  style={{
                    color: h.totalDiff >= 0 ? "#5ccb8a" : "#e06060",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {h.totalDiff >= 0 ? "+" : "-"}
                  {fmtLarge(Math.abs(h.totalDiff))}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Log-scale axis — always full container width */}
        <svg ref={axisRef} className="s-axis" />
      </div>

      {/* ── Enemy & Ailments panel ── */}
      <div className="s-enemy">
        <button
          className="s-enemy__header"
          onClick={() => setEnemyOpen((o) => !o)}
        >
          <span className="s-enemy__chevron">{enemyOpen ? "▾" : "▸"}</span>
          <span>Enemy &amp; Ailments</span>
          <label
            className="s-enemy__enable"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={enemy.enabled}
              onChange={(e) => {
                setEnemyField("enabled", e.target.checked);
                if (e.target.checked) setEnemyOpen(true);
              }}
            />
            Enable
          </label>
        </button>
        {enemyOpen && (
          <div className="s-enemy__body">
            <div className="s-enemy__row">
              <span className="s-enemy__lbl">Enemy resistance</span>
              <Scrubber
                value={enemy.resistance}
                onChange={(v) => {
                  setEnemyField("resistance", v);
                  setResistancePreset("");
                }}
                onCommit={(v, prev) => {
                  const prevEnemy = { ...enemyRef.current, resistance: prev };
                  const newEnemy = { ...enemyRef.current, resistance: v };
                  handleEnemyCommit(
                    prevEnemy,
                    newEnemy,
                    signedPct(v - prev),
                    "Resistance",
                    "#e06060",
                  );
                }}
                format={(v) => `${Math.round(v)}%`}
                sensitivity={0.3}
                min={-100}
                max={75}
                color={enemy.enabled ? "#e06060" : undefined}
              />
              <select
                className="s-enemy__preset"
                value={resistancePreset}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const v = parseInt(val, 10);
                  const prevEnemy = enemyRef.current;
                  const newEnemy = { ...prevEnemy, resistance: v };
                  setEnemyField("resistance", v);
                  setResistancePreset(val);
                  handleEnemyCommit(
                    prevEnemy,
                    newEnemy,
                    signedPct(v - prevEnemy.resistance),
                    "Resistance",
                    "#e06060",
                  );
                }}
              >
                <option value="" disabled>
                  mob presets
                </option>
                <option value="0">Normal — 0%</option>
                <option value="0m">Magic — 0%</option>
                <option value="15">Rare — 15%</option>
                <option value="30">Boss — 30%</option>
                <option value="60">Pinnacle — 60%</option>
              </select>
              <span className="s-tip">
                ?
                <span className="s-tip__popup">
                  Very rough estimates for quick testing. Actual resistances
                  vary widely — auras, map modifiers, buffs, and other factors
                  all influence them.
                </span>
              </span>
            </div>
            <div className="s-enemy__row s-enemy__row--indent">
              <label className="s-enemy__check">
                <input
                  type="checkbox"
                  checked={enemy.rakiataEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const prevEnemy = enemyRef.current;
                    const newEnemy = { ...prevEnemy, rakiataEnabled: checked };
                    setEnemyField("rakiataEnabled", checked);
                    handleEnemyCommit(
                      prevEnemy,
                      newEnemy,
                      checked ? "ON" : "OFF",
                      "Rakiata's Flow",
                      "#c8a96e",
                    );
                  }}
                />
                Rakiata&apos;s Flow
              </label>
            </div>
            <div className="s-enemy__row s-enemy__row--indent">
              <span className="s-enemy__lbl">Penetration</span>
              <Scrubber
                value={enemy.penetration}
                onChange={(v) => setEnemyField("penetration", v)}
                onCommit={(v, prev) => {
                  const prevEnemy = { ...enemyRef.current, penetration: prev };
                  const newEnemy = { ...enemyRef.current, penetration: v };
                  handleEnemyCommit(
                    prevEnemy,
                    newEnemy,
                    signedPct(v - prev),
                    "Penetration",
                    "#5ccb8a",
                  );
                }}
                format={(v) => `−${Math.round(v)}%`}
                sensitivity={0.3}
                min={0}
                max={100}
              />
            </div>
            <div className="s-enemy__row s-enemy__row--indent">
              <label className="s-enemy__check">
                <input
                  type="checkbox"
                  checked={enemy.exposureEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const prevEnemy = enemyRef.current;
                    const newEnemy = { ...prevEnemy, exposureEnabled: checked };
                    setEnemyField("exposureEnabled", checked);
                    handleEnemyCommit(
                      prevEnemy,
                      newEnemy,
                      checked
                        ? `ON (\u221210 → \u2212${Math.round(prevEnemy.exposure)}%)`
                        : "OFF",
                      "Exposure",
                      "#5ccb8a",
                    );
                  }}
                />
                Exposure
              </label>
              {enemy.exposureEnabled && (
                <Scrubber
                  value={enemy.exposure}
                  onChange={(v) => setEnemyField("exposure", v)}
                  onCommit={(v, prev) => {
                    const prevEnemy = { ...enemyRef.current, exposure: prev };
                    const newEnemy = { ...enemyRef.current, exposure: v };
                    handleEnemyCommit(
                      prevEnemy,
                      newEnemy,
                      signedPct(v - prev),
                      "Exposure",
                      "#5ccb8a",
                    );
                  }}
                  format={(v) => `−${Math.round(v)}%`}
                  sensitivity={0.2}
                  min={0}
                  max={50}
                />
              )}
            </div>
            <div className="s-enemy__row s-enemy__row--indent">
              <label className="s-enemy__check">
                <input
                  type="checkbox"
                  checked={enemy.curseEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const prevEnemy = enemyRef.current;
                    const newEnemy = { ...prevEnemy, curseEnabled: checked };
                    setEnemyField("curseEnabled", checked);
                    handleEnemyCommit(
                      prevEnemy,
                      newEnemy,
                      checked
                        ? `ON (\u221220 → \u2212${Math.round(prevEnemy.curseRes)}%)`
                        : "OFF",
                      "Curse Res.",
                      "#5ccb8a",
                    );
                  }}
                />
                Curse (Lower Resistance)
              </label>
              {enemy.curseEnabled && (
                <Scrubber
                  value={enemy.curseRes}
                  onChange={(v) => setEnemyField("curseRes", v)}
                  onCommit={(v, prev) => {
                    const prevEnemy = { ...enemyRef.current, curseRes: prev };
                    const newEnemy = { ...enemyRef.current, curseRes: v };
                    handleEnemyCommit(
                      prevEnemy,
                      newEnemy,
                      signedPct(v - prev),
                      "Curse Res.",
                      "#5ccb8a",
                    );
                  }}
                  format={(v) => `−${Math.round(v)}%`}
                  sensitivity={0.3}
                  min={0}
                  max={60}
                />
              )}
            </div>
            <div className="s-enemy__row s-enemy__eff-res">
              <span className="s-enemy__lbl">Effective Resistance</span>
              <span
                style={{
                  color:
                    effectiveRes < 0
                      ? "#a060e0"
                      : effectiveRes > 0
                        ? "#e06060"
                        : "#5ccb8a",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                {Math.round(effectiveRes)}%
              </span>
            </div>
            <div className="s-enemy__divider" />
            <div className="s-enemy__row">
              <label className="s-enemy__check">
                <input
                  type="checkbox"
                  checked={enemy.shockEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const prevEnemy = enemyRef.current;
                    const newEnemy = { ...prevEnemy, shockEnabled: checked };
                    setEnemyField("shockEnabled", checked);
                    handleEnemyCommit(
                      prevEnemy,
                      newEnemy,
                      checked
                        ? `${Math.round(prevEnemy.shockEffect * (1 + prevEnemy.shockMagnitude / 100))}% inc. dmg taken`
                        : "OFF",
                      "Shock",
                      "#4ab3cf",
                    );
                  }}
                />
                Shock
              </label>
              {enemy.shockEnabled && (
                <>
                  <span className="s-enemy__lbl s-enemy__lbl--inline">
                    Effect
                  </span>
                  <Scrubber
                    value={enemy.shockEffect}
                    onChange={(v) => setEnemyField("shockEffect", v)}
                    onCommit={(v, prev) => {
                      const prevEnemy = {
                        ...enemyRef.current,
                        shockEffect: prev,
                      };
                      const newEnemy = { ...enemyRef.current, shockEffect: v };
                      handleEnemyCommit(
                        prevEnemy,
                        newEnemy,
                        signedPct(v - prev),
                        "Shock Effect",
                        "#4ab3cf",
                      );
                    }}
                    format={(v) => `${Math.round(v)}%`}
                    sensitivity={0.2}
                    min={1}
                    max={100}
                    color="#4ab3cf"
                  />
                  <span className="s-enemy__lbl s-enemy__lbl--inline">
                    Mag.
                  </span>
                  <Scrubber
                    value={enemy.shockMagnitude}
                    onChange={(v) => setEnemyField("shockMagnitude", v)}
                    onCommit={(v, prev) => {
                      const prevEnemy = {
                        ...enemyRef.current,
                        shockMagnitude: prev,
                      };
                      const newEnemy = {
                        ...enemyRef.current,
                        shockMagnitude: v,
                      };
                      handleEnemyCommit(
                        prevEnemy,
                        newEnemy,
                        signedPct(v - prev),
                        "Shock Mag.",
                        "#4ab3cf",
                      );
                    }}
                    format={(v) => `+${Math.round(v)}%`}
                    sensitivity={0.5}
                    min={0}
                    max={500}
                    color="#4ab3cf"
                  />
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "#4ab3cf",
                      marginLeft: "0.25rem",
                      fontWeight: 700,
                    }}
                  >
                    {"→"}{" "}
                    {Math.round(
                      enemy.shockEffect * (1 + enemy.shockMagnitude / 100),
                    )}
                    % increased damage taken
                    {enemy.shockMagnitude > 0 &&
                      ` (${(1 + enemy.shockMagnitude / 100).toFixed(1)}×)`}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Part 2: damage vs target life ───────────────────────────── */}
      <div className="s-compare">
        <div className="s-compare__row">
          <div className="s-compare__label">Damage Dealt</div>
          <div className="s-compare__track-wrap">
            {enemy.enabled && effectiveRes !== 0 && (
              <div
                className="s-compare__above-label"
                style={{
                  left: `${
                    effectiveRes > 0
                      ? (shockEndPct + rawEndPct) / 2
                      : (rawEndPct + dealtEndPct) / 2
                  }%`,
                  transform: "translateX(-50%)",
                }}
              >
                {effectiveRes > 0
                  ? "Resistance reduced damage"
                  : "Resistance increased damage"}
              </div>
            )}
            <div className="s-compare__track">
              {/* Ghost: faded outline showing raw damage absorbed by resistance */}
              {enemy.enabled && effectiveRes > 0 && (
                <div
                  className="s-compare__ghost"
                  style={{ width: `${rawEndPct}%` }}
                />
              )}
              {/* Absorbed: label centered in the gap between dealt and raw endpoint */}
              {enemy.enabled && effectiveRes > 0 && total > dealt && (
                <div
                  className="s-compare__gap-label"
                  style={{
                    left: `${shockEndPct}%`,
                    width: `${rawEndPct - shockEndPct}%`,
                  }}
                >
                  −{fmtLarge(total - dealt)}
                </div>
              )}
              {/* Pipeline segments clipped to afterRes (or raw when no res reduction) */}
              <div
                className="s-compare__bar s-compare__bar--damage"
                style={{
                  width: `${Math.min(dealtEndPct, rawEndPct)}%`,
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                }}
              >
                {sections.map((s) => (
                  <div
                    key={s.key}
                    className="s-seg"
                    style={{
                      flex: Math.max(s.contrib, 0.001),
                      backgroundColor: s.color,
                    }}
                  />
                ))}
              </div>
              {/* Neg-res bonus: violet extension past raw when res goes negative */}
              {enemy.enabled && effectiveRes < 0 && (
                <div
                  className="s-compare__bar s-compare__bar--negres"
                  style={{
                    width: `${dealtEndPct - rawEndPct}%`,
                    position: "absolute",
                    left: `${rawEndPct}%`,
                    top: 0,
                    bottom: 0,
                  }}
                >
                  <span className="s-compare__seg-label">
                    +{fmtLarge(afterRes - total)}
                  </span>
                </div>
              )}
              {/* Shock bonus: teal extension */}
              {enemy.enabled && enemy.shockEnabled && (
                <div
                  className="s-compare__bar s-compare__bar--shock"
                  style={{
                    width: `${shockEndPct - dealtEndPct}%`,
                    position: "absolute",
                    left: `${dealtEndPct}%`,
                    top: 0,
                    bottom: 0,
                  }}
                >
                  <span className="s-compare__seg-label">
                    +{fmtLarge(shockBonus)}
                  </span>
                </div>
              )}
              {/* Dashed line at raw damage endpoint for reference */}
              {enemy.enabled && (effectiveRes !== 0 || enemy.shockEnabled) && (
                <div
                  className="s-compare__rawline"
                  style={{ left: `${rawEndPct}%` }}
                />
              )}
            </div>
          </div>
          <div className="s-compare__val">{fmtLarge(dealt)}</div>
        </div>

        <div className="s-compare__row">
          <div className="s-compare__label">Target Life</div>
          <div className="s-compare__track">
            <div
              className="s-compare__bar s-compare__bar--life"
              style={{ width: `${lifePct}%` }}
            />
          </div>
          <div className="s-compare__val">
            <select
              className="s-life-select"
              value={targetLife}
              onChange={(e) => setTargetLife(Number(e.target.value))}
            >
              {LIFE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
