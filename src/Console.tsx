import { useEffect, useMemo, useState } from "react";
import {
  API_BASE,
  checkHealth,
  fetchModelCard,
  predict,
  type ModelCard,
  type Prediction,
} from "./api";

const PRESETS = ["WC", "TiB2", "B4C", "SiC", "Al2O3", "Si", "GaAs", "ZrO2"];
const CLASSICS = "WC TiB2 B4C SiC Al2O3 ZrO2";

function parse(input: string): string[] {
  return [...new Set(input.split(/[\s,;]+/).filter(Boolean))].slice(0, 25);
}

/* ────────────────────────── pipeline animation ────────────────────────── */

const STEPS = [
  "parsing compositions",
  "computing elemental descriptors",
  "assembling the 132-dimension feature vector",
  "evaluating trained heads: G, K, band gap",
  "estimating density from element volumes",
  "applying elasticity relations: E, ν, hardness",
  "propagating elastic waves: speeds and shock impedance",
  "classifying electronic character",
];
const STEP_MS = 1050;
const MIN_SHOW_MS = STEPS.length * STEP_MS + 400;

const DESCRIPTORS = [
  "electronegativity",
  "covalent radius",
  "valence electrons",
  "melting point",
  "atomic volume",
  "ionization character",
  "d-electron fraction",
  "ground-state volume",
  "atomic mass",
  "unfilled orbitals",
];

function parseElements(formulas: string[]): string[] {
  const set = new Set<string>();
  for (const f of formulas)
    for (const m of f.matchAll(/([A-Z][a-z]?)\d*/g)) set.add(m[1]);
  return [...set].slice(0, 12);
}

function PipelineLoading({ formulas }: { formulas: string[] }) {
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0);
  const elements = useMemo(() => parseElements(formulas), [formulas]);

  useEffect(() => {
    const stepper = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      STEP_MS,
    );
    const ticker = setInterval(() => setTick((t) => t + 1), 210);
    return () => {
      clearInterval(stepper);
      clearInterval(ticker);
    };
  }, []);

  return (
    <div className="pload" role="status" aria-label="Prediction in progress">
      <i className="pload__wave" aria-hidden="true" />
      <div className="pload__left">
        <div className="pload__elements">
          {elements.map((sym, i) => (
            <span className="el" key={sym} style={{ animationDelay: `${i * 110}ms` }}>
              <b>{sym}</b>
              <i className="el__orbit" aria-hidden="true" />
              <i className="el__orbit el__orbit--2" aria-hidden="true" />
            </span>
          ))}
        </div>
        <ol className="pload__steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? "is-done" : i === step ? "is-active" : ""}>
              <i />
              {s}
              {i === 1 && i === step && <em> · {DESCRIPTORS[tick % DESCRIPTORS.length]}</em>}
            </li>
          ))}
        </ol>
        {step >= 5 && (
          <p className="pload__eq">
            E = 9KG / (3K + G) &nbsp;·&nbsp; ν = (3K − 2G) / 2(3K + G) &nbsp;·&nbsp; Hᵥ =
            2(k²G)<sup>0.585</sup> − 3
          </p>
        )}
        {step >= 6 && (
          <div className="lattice" aria-hidden="true">
            {Array.from({ length: 42 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${(i % 14) * 110}ms` }} />
            ))}
            <span className="lattice__cap">shear wave crossing the lattice · v = √(G/ρ)</span>
          </div>
        )}
      </div>
      <div className="pload__right">
        <div className="pload__grid" aria-hidden="true">
          {Array.from({ length: 132 }, (_, i) => (
            <i
              key={i}
              className={step >= 1 ? "fg on" : "fg"}
              style={{ animationDelay: `${STEP_MS + i * 11}ms` }}
            />
          ))}
          <i className={step >= 2 ? "pload__scan" : ""} aria-hidden="true" />
        </div>
        <span className="pload__gridLabel">132 physics descriptors</span>
        <div className="pload__heads" aria-hidden="true">
          {["shear G", "bulk K", "band gap"].map((h, i) => (
            <span
              key={h}
              className={step >= 3 ? "hnode on" : "hnode"}
              style={{ animationDelay: `${i * 220}ms` }}
            >
              {h}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── scientific charts ────────────────────────── */

/* Ashby chart: Young's modulus against density, log axes, with reference materials. */

const REFS = [
  { name: "Polycarbonate", e: 2.4, rho: 1.2 },
  { name: "CFRP", e: 70, rho: 1.6 },
  { name: "Aluminum", e: 69, rho: 2.7 },
  { name: "SiC", e: 410, rho: 3.21 },
  { name: "Diamond", e: 1050, rho: 3.52 },
  { name: "Alumina", e: 390, rho: 3.95 },
  { name: "Titanium", e: 114, rho: 4.51 },
  { name: "Steel", e: 200, rho: 7.85 },
  { name: "Copper", e: 117, rho: 8.96 },
];

const AW = 560;
const AH = 380;
const AM = { t: 20, r: 22, b: 44, l: 52 };
const RHO_MIN = 0.9;
const RHO_MAX = 20;
const E_MIN = 1;
const E_MAX = 1500;

const ax = (rho: number) =>
  AM.l + ((Math.log(rho) - Math.log(RHO_MIN)) / (Math.log(RHO_MAX) - Math.log(RHO_MIN))) * (AW - AM.l - AM.r);
const ay = (e: number) =>
  AH - AM.b - ((Math.log(e) - Math.log(E_MIN)) / (Math.log(E_MAX) - Math.log(E_MIN))) * (AH - AM.t - AM.b);

function Ashby({ batch, selected }: { batch: Prediction[]; selected: Prediction }) {
  const points = batch.filter(
    (r) => r.youngs_modulus_gpa != null && r.density_est_gcc != null,
  );
  return (
    <figure className="panel">
      <figcaption className="panel__cap">
        <b>Stiffness against weight</b>
        <span>
          The chart materials engineers select with. Up and left is stiff and light. Gray points
          are textbook reference materials, blue points are this screening.
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${AW} ${AH}`} className="panel__svg" role="img" aria-label="Young's modulus against density on log axes">
        {[1, 10, 100, 1000].map((e) => (
          <g key={e}>
            <line x1={AM.l} x2={AW - AM.r} y1={ay(e)} y2={ay(e)} className="sgrid" />
            <text x={AM.l - 8} y={ay(e) + 4} className="stick" textAnchor="end">
              {e}
            </text>
          </g>
        ))}
        {[1, 2, 5, 10, 20].map((d) => (
          <text key={d} x={ax(d)} y={AH - AM.b + 20} className="stick" textAnchor="middle">
            {d}
          </text>
        ))}
        <text x={AM.l} y={12} className="saxis">
          Young's modulus E · GPa
        </text>
        <text x={AW - AM.r} y={AH - 6} className="saxis" textAnchor="end">
          density · g/cm³
        </text>
        {REFS.map((m) => (
          <g key={m.name}>
            <circle cx={ax(m.rho)} cy={ay(m.e)} r={4} className="spt spt--ref" />
            <text x={ax(m.rho) + 7} y={ay(m.e) + 4} className="slabel">
              {m.name}
            </text>
          </g>
        ))}
        {points.map((r) => {
          const isSel = r.formula === selected.formula;
          return (
            <g key={r.formula}>
              <circle
                cx={ax(r.density_est_gcc!)}
                cy={ay(r.youngs_modulus_gpa!)}
                r={isSel ? 7 : 5}
                className={isSel ? "spt spt--sel" : "spt spt--batch"}
              />
              <text
                x={ax(r.density_est_gcc!) + 9}
                y={ay(r.youngs_modulus_gpa!) - 6}
                className={isSel ? "slabel slabel--sel" : "slabel slabel--batch"}
              >
                {r.formula}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/* Property profile: five normalized axes. */

const PAXES = [
  { key: "stiff", label: "Stiffness" },
  { key: "hard", label: "Hardness" },
  { key: "light", label: "Lightness" },
  { key: "imped", label: "Impedance" },
  { key: "gap", label: "Band gap" },
] as const;

function profileOf(r: Prediction): number[] {
  const clamp = (v: number) => Math.max(0.03, Math.min(1, v));
  return [
    clamp((r.youngs_modulus_gpa ?? 0) / 700),
    clamp((r.vickers_hardness_gpa ?? 0) / 40),
    clamp(2 / (r.density_est_gcc ?? 20)),
    clamp((r.acoustic_impedance_mrayl ?? 0) / 110),
    clamp((r.band_gap_ev ?? 0) / 6),
  ];
}

const RW = 340;
const RC = RW / 2;
const RR = 110;

function radarPoints(values: number[], scale = 1): string {
  return values
    .map((v, i) => {
      const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
      const r = RR * v * scale;
      return `${RC + r * Math.cos(angle)},${RC + r * Math.sin(angle)}`;
    })
    .join(" ");
}

function Profile({ selected }: { selected: Prediction }) {
  const vals = profileOf(selected);
  return (
    <figure className="panel">
      <figcaption className="panel__cap">
        <b>Property profile</b>
        <span>
          Five properties on one shape, each scaled to a strong engineering material. A bigger
          footprint means a stronger all-round candidate.
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${RW} ${RW}`} className="panel__svg panel__svg--radar" role="img" aria-label="Property profile radar">
        {[0.25, 0.5, 0.75, 1].map((s) => (
          <polygon key={s} points={radarPoints([1, 1, 1, 1, 1], s)} className="rgrid" />
        ))}
        {PAXES.map((a, i) => {
          const angle = (Math.PI * 2 * i) / PAXES.length - Math.PI / 2;
          return (
            <g key={a.key}>
              <line
                x1={RC}
                y1={RC}
                x2={RC + RR * Math.cos(angle)}
                y2={RC + RR * Math.sin(angle)}
                className="rgrid"
              />
              <text
                x={RC + (RR + 18) * Math.cos(angle)}
                y={RC + (RR + 18) * Math.sin(angle) + 4}
                className="slabel"
                textAnchor="middle"
              >
                {a.label}
              </text>
            </g>
          );
        })}
        <polygon points={radarPoints(vals)} className="rshape" />
        {vals.map((v, i) => {
          const angle = (Math.PI * 2 * i) / vals.length - Math.PI / 2;
          return (
            <circle
              key={i}
              cx={RC + RR * v * Math.cos(angle)}
              cy={RC + RR * v * Math.sin(angle)}
              r={3.5}
              className="spt spt--sel"
            />
          );
        })}
      </svg>
    </figure>
  );
}

/* ────────────────────────── known data (Materials Project) ────────────────────────── */

type Known = {
  polymorphs: number;
  stable?: {
    material_id: string;
    crystal_system?: string;
    spacegroup?: string;
    density_gcc?: number;
    dft_shear_gpa?: number;
    dft_bulk_gpa?: number;
  };
};
type KnownState = Known | "loading" | "none";

/* ────────────────────────── comparison table ────────────────────────── */

type Col = {
  label: string;
  unit: string;
  get: (r: Prediction) => number | string | undefined;
  max?: number;
};

const COLS: Col[] = [
  { label: "Shear G", unit: "GPa", get: (r) => r.shear_modulus_gpa ?? undefined, max: 300 },
  { label: "Bulk K", unit: "GPa", get: (r) => r.bulk_modulus_gpa, max: 420 },
  { label: "Young E", unit: "GPa", get: (r) => r.youngs_modulus_gpa, max: 700 },
  { label: "Poisson ν", unit: "", get: (r) => r.poisson_ratio, max: 0.5 },
  { label: "Hardness", unit: "GPa", get: (r) => r.vickers_hardness_gpa, max: 40 },
  { label: "Density", unit: "g/cm³", get: (r) => r.density_est_gcc, max: 16 },
  { label: "E/ρ", unit: "", get: (r) => r.specific_stiffness_gpa_gcc, max: 180 },
  { label: "Impedance", unit: "MRayl", get: (r) => r.acoustic_impedance_mrayl, max: 110 },
  { label: "Gap", unit: "eV", get: (r) => r.band_gap_ev, max: 6 },
  { label: "Class", unit: "", get: (r) => r.electronic_class },
  { label: "Pugh", unit: "", get: (r) => r.character },
];

function CompareTable({
  batch,
  selected,
  onSelect,
}: {
  batch: Prediction[];
  selected: Prediction;
  onSelect: (formula: string) => void;
}) {
  return (
    <section className="detail__sec">
      <h3>Comparison table</h3>
      <p className="ctable__cap">
        Every screened material side by side. Deeper blue means a larger value in that column.
        Click a row to inspect it.
      </p>
      <div className="ctable__wrap">
        <table className="ctable">
          <thead>
            <tr>
              <th>Material</th>
              {COLS.map((c) => (
                <th key={c.label}>
                  {c.label}
                  {c.unit && <i> {c.unit}</i>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batch.map((r) => (
              <tr
                key={r.formula}
                className={r.formula === selected.formula ? "is-sel" : ""}
                onClick={() => onSelect(r.formula)}
              >
                <td>{r.formula}</td>
                {COLS.map((c) => {
                  const v = c.get(r);
                  const tint =
                    typeof v === "number" && c.max
                      ? Math.min(Math.abs(v) / c.max, 1) * 0.16
                      : 0;
                  return (
                    <td
                      key={c.label}
                      style={tint ? { background: `rgba(10, 99, 216, ${tint})` } : undefined}
                    >
                      {v == null ? "–" : typeof v === "number" ? v.toLocaleString() : v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ────────────────────────── property cells ────────────────────────── */

function Cell({
  name,
  value,
  unit,
  caption,
  tone,
}: {
  name: string;
  value: string | number;
  unit?: string;
  caption: string;
  tone?: "good" | "warn" | "accent";
}) {
  return (
    <div
      className={`cell${tone ? ` cell--${tone}` : ""}${typeof value === "string" ? " cell--tag" : ""}`}
    >
      <span className="cell__name">{name}</span>
      <b className="cell__val">
        {typeof value === "number" ? value.toLocaleString() : value} {unit && <i>{unit}</i>}
      </b>
      <span className="cell__cap">{caption}</span>
    </div>
  );
}

/* ────────────────────────── the console ────────────────────────── */

export default function Console() {
  const [entered, setEntered] = useState(() => localStorage.getItem("alpha_entered") === "1");
  const [name, setName] = useState(() => localStorage.getItem("alpha_name") ?? "");

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Prediction[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [known, setKnown] = useState<Record<string, KnownState>>({});
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [card, setCard] = useState<ModelCard | null>(null);

  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const ping = async () => {
      const ok = await checkHealth();
      setStatus(ok ? "online" : "offline");
      if (!ok && tries++ < 20) timer = setTimeout(ping, 15000);
    };
    ping();
    fetchModelCard().then((c) => c && setCard(c));
    return () => clearTimeout(timer);
  }, []);

  const valid = results?.filter((r) => r.shear_modulus_gpa !== null) ?? [];
  const failed = results?.filter((r) => r.shear_modulus_gpa === null) ?? [];
  const sel = valid.find((r) => r.formula === selected) ?? valid[0];

  useEffect(() => {
    if (!sel || known[sel.formula] !== undefined) return;
    setKnown((k) => ({ ...k, [sel.formula]: "loading" }));
    fetch(`${API_BASE}/structure?formula=${encodeURIComponent(sel.formula)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: Known | null) =>
        setKnown((k) => ({ ...k, [sel.formula]: d && d.polymorphs > 0 ? d : "none" })),
      )
      .catch(() => setKnown((k) => ({ ...k, [sel.formula]: "none" })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.formula]);

  const run = async (raw: string) => {
    const formulas = parse(raw);
    if (formulas.length === 0 || loading) return;
    setLoading(true);
    setPending(formulas);
    setError(null);
    const started = Date.now();
    try {
      const res = await predict(formulas);
      const remaining = MIN_SHOW_MS - (Date.now() - started);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setResults(res);
      setSelected(res.find((r) => r.shear_modulus_gpa !== null)?.formula ?? null);
      setKnown({});
    } catch {
      setError(
        "The engine could not be reached. The free tier sleeps when idle. Give it about 40 seconds, then try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* entry screen */
  if (!entered) {
    return (
      <div
        className="gate"
        style={
          {
            "--gate-bg": `url(${import.meta.env.BASE_URL}hero-bg.png)`,
          } as React.CSSProperties
        }
      >
        <div className="gate__card">
          <img className="gate__logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="ALPHA" />
          <h1 className="gate__title">ALPHA</h1>
          <p className="gate__sub">Material Intelligence Console</p>
          <input
            className="gate__input"
            placeholder="Your name, optional"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="gate__enter"
            onClick={() => {
              localStorage.setItem("alpha_entered", "1");
              localStorage.setItem("alpha_name", name.trim());
              setEntered(true);
            }}
          >
            Enter console
          </button>
          <p className="gate__foot">Screening grade decision support. Not certified design values.</p>
        </div>
      </div>
    );
  }

  const scaleMax = Math.max(...valid.map((r) => r.high_gpa ?? 0), 1);

  return (
    <div className="shell">
      <header className="bar">
        <div className="bar__brand">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
          <b>ALPHA</b>
          <span>Console</span>
        </div>
        <div className="bar__right">
          <span className={`status status--${status}`}>
            <i />
            {status === "online" ? "Engine online" : status === "checking" ? "Checking engine" : "Engine waking"}
          </span>
          <span className="top__badge">Screening only</span>
          {name && <span className="bar__user">{name}</span>}
        </div>
      </header>

      <div className="work">
        {/* left: input + list */}
        <aside className="side">
          <form
            className="side__form"
            onSubmit={(e) => {
              e.preventDefault();
              run(input);
            }}
          >
            <input
              className="side__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="WC, TiB2, B4C…"
              spellCheck={false}
              autoFocus
            />
            <button className="side__go" type="submit" disabled={loading || !parse(input).length}>
              {loading ? "…" : "Screen"}
            </button>
          </form>
          <div className="side__chips">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className="chip"
                onClick={() => setInput((v) => (parse(v).includes(p) ? v : `${v} ${p}`.trim()))}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              className="chip chip--all"
              onClick={() => {
                setInput(CLASSICS);
                run(CLASSICS);
              }}
            >
              Screen the classics
            </button>
          </div>

          {error && <p className="predict__error">{error}</p>}
          {failed.length > 0 && !loading && (
            <p className="predict__failed">
              Not recognised: {failed.map((r) => r.formula).join(", ")}
            </p>
          )}

          {valid.length > 0 && !loading && (
            <ol className="mlist">
              {valid.map((r) => (
                <li key={r.formula}>
                  <button
                    className={sel?.formula === r.formula ? "mrow is-sel" : "mrow"}
                    onClick={() => setSelected(r.formula)}
                  >
                    <span className="mrow__rank">{String(r.rank).padStart(2, "0")}</span>
                    <span className="mrow__formula">{r.formula}</span>
                    <span className="mrow__bar" aria-hidden="true">
                      <i style={{ width: `${((r.shear_modulus_gpa ?? 0) / scaleMax) * 100}%` }} />
                    </span>
                    <span className="mrow__val">{r.shear_modulus_gpa}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}

          {card && (
            <details className="about">
              <summary>About the model</summary>
              <p>
                Trained heads:{" "}
                {(card.heads ?? [])
                  .map((h) => `${h.target} R² ${h.r2}, MAE ${h.mae} ${h.unit}`)
                  .join(" · ")}
                . Ranges are calibrated 90 percent intervals, verified at 90 to 91 percent
                coverage. Splits are grouped by formula. Composition-only estimates: a formula
                does not specify crystal phase or processing.
              </p>
            </details>
          )}
        </aside>

        {/* right: detail */}
        <main className="detail">
          {loading && <PipelineLoading formulas={pending} />}

          {!loading && !sel && (
            <div className="empty">
              <p className="empty__serif">Screen materials to begin.</p>
              <p>Type formulas on the left, or run the classics.</p>
            </div>
          )}

          {!loading && sel && (
            <>
              <header className="detail__head">
                <h1 className="detail__formula">{sel.formula}</h1>
                <div className="detail__tags">
                  {sel.domain && (
                    <span
                      className={`rrow__tag ${sel.domain === "in_domain" ? "rrow__tag--in" : "rrow__tag--out"}`}
                    >
                      {sel.domain === "in_domain" ? "In domain" : "Extrapolating"}
                    </span>
                  )}
                  <span className="rrow__badge">Screening only</span>
                </div>
                <div className="detail__hero">
                  <span className="detail__heroVal">
                    {sel.shear_modulus_gpa} <i>GPa</i>
                  </span>
                  <span className="detail__heroCap">
                    predicted shear modulus, ± {sel.shear_conformal90_gpa ?? sel.uncertainty_gpa} at
                    90 percent confidence
                  </span>
                  <span className="detail__range" aria-hidden="true">
                    <i
                      className="detail__rangeBand"
                      style={{
                        left: `${Math.max(((sel.low_gpa ?? 0) / scaleMax) * 100, 0)}%`,
                        width: `${(((sel.high_gpa ?? 0) - Math.max(sel.low_gpa ?? 0, 0)) / scaleMax) * 100}%`,
                      }}
                    />
                    <i
                      className="detail__rangeDot"
                      style={{ left: `${((sel.shear_modulus_gpa ?? 0) / scaleMax) * 100}%` }}
                    />
                  </span>
                </div>
                {sel.neighbors && sel.neighbors.length > 0 && (
                  <p className="rrow__nbrs">
                    Closest training materials:{" "}
                    {sel.neighbors.map((n, i) => (
                      <span key={n.formula + i}>
                        {i > 0 && ", "}
                        <code>{n.formula}</code> {n.shear_modulus_gpa} GPa
                      </span>
                    ))}{" "}
                    (measured)
                  </p>
                )}
              </header>

              <section className="detail__sec">
                <h3>Mechanical</h3>
                <div className="pgrid">
                  <Cell
                    name="Shear modulus G"
                    value={sel.shear_modulus_gpa ?? 0}
                    unit={`GPa ± ${sel.shear_conformal90_gpa ?? sel.uncertainty_gpa}`}
                    caption="Resistance to changing shape"
                  />
                  {sel.bulk_modulus_gpa != null && (
                    <Cell
                      name="Bulk modulus K"
                      value={sel.bulk_modulus_gpa}
                      unit={`GPa ± ${sel.bulk_conformal90_gpa ?? sel.bulk_uncertainty_gpa}`}
                      caption="Resistance to compression"
                    />
                  )}
                  {sel.youngs_modulus_gpa != null && (
                    <Cell
                      name="Young's modulus E"
                      value={sel.youngs_modulus_gpa}
                      unit="GPa"
                      caption="Stiffness in a pull test, from K and G"
                    />
                  )}
                  {sel.poisson_ratio != null && (
                    <Cell
                      name="Poisson's ratio ν"
                      value={sel.poisson_ratio}
                      caption="Sideways spread when stretched"
                    />
                  )}
                  {sel.vickers_hardness_gpa != null && (
                    <Cell
                      name="Estimated hardness"
                      value={sel.vickers_hardness_gpa}
                      unit="GPa"
                      caption="Scratch and dent resistance, Chen-Niu estimate, not a test"
                    />
                  )}
                  {sel.character && (
                    <Cell
                      name="Pugh tendency"
                      value={sel.character}
                      caption="Leaning toward brittle or tougher failure, an indicator only"
                      tone={sel.character === "less brittle" ? "good" : "warn"}
                    />
                  )}
                </div>
              </section>

              <div className="detail__figs">
                <Ashby batch={valid} selected={sel} />
                <Profile selected={sel} />
              </div>

              <CompareTable batch={valid} selected={sel} onSelect={setSelected} />

              <section className="detail__sec">
                <h3>Impact and thermal</h3>
                <div className="pgrid">
                  {sel.density_est_gcc != null && (
                    <Cell
                      name="Density, estimated"
                      value={sel.density_est_gcc}
                      unit="g/cm³"
                      caption="Weight per volume, from element data"
                    />
                  )}
                  {sel.specific_stiffness_gpa_gcc != null && (
                    <Cell
                      name="Specific stiffness E/ρ"
                      value={sel.specific_stiffness_gpa_gcc}
                      unit="GPa·cm³/g"
                      caption="Stiffness per unit weight, key for light structures"
                    />
                  )}
                  {sel.sound_speed_shear_ms != null && (
                    <Cell
                      name="Shear wave speed"
                      value={sel.sound_speed_shear_ms}
                      unit="m/s"
                      caption="How fast a shape wave travels through it"
                    />
                  )}
                  {sel.sound_speed_long_ms != null && (
                    <Cell
                      name="Pressure wave speed"
                      value={sel.sound_speed_long_ms}
                      unit="m/s"
                      caption="How fast a compression wave travels"
                    />
                  )}
                  {sel.acoustic_impedance_mrayl != null && (
                    <Cell
                      name="Acoustic impedance"
                      value={sel.acoustic_impedance_mrayl}
                      unit="MRayl"
                      caption="How it passes or reflects shock, used to layer armor"
                      tone="accent"
                    />
                  )}
                  {sel.kmin_clarke_w_mk != null && (
                    <Cell
                      name="Minimum heat flow"
                      value={sel.kmin_clarke_w_mk}
                      unit="W/m·K"
                      caption="Lower bound on thermal conductivity, Clarke model"
                    />
                  )}
                </div>
              </section>

              <section className="detail__sec">
                <h3>Electronic</h3>
                <div className="pgrid">
                  {sel.band_gap_ev != null && (
                    <Cell
                      name="Band gap"
                      value={sel.band_gap_ev}
                      unit={`eV ± ${sel.band_gap_conformal90_ev ?? sel.band_gap_uncertainty_ev}`}
                      caption="Energy gap that sets electrical behavior"
                    />
                  )}
                  {sel.electronic_class && (
                    <Cell
                      name="Electronic class"
                      value={sel.electronic_class}
                      caption="Metal conducts, semiconductor switches, insulator blocks"
                      tone="accent"
                    />
                  )}
                </div>
              </section>

              <section className="detail__sec">
                <h3>Known data, Materials Project</h3>
                <div className="pgrid">
                  {(() => {
                    const k = known[sel.formula];
                    if (k === "loading" || k === undefined)
                      return (
                        <Cell
                          name="Materials Project"
                          value="Looking up"
                          caption="Querying known crystal structures"
                        />
                      );
                    if (k === "none")
                      return (
                        <Cell
                          name="Materials Project"
                          value="No entry"
                          caption="No known crystal for this composition. Our estimate is the only number available."
                        />
                      );
                    return (
                      <>
                        <Cell
                          name="Known structures"
                          value={k.polymorphs}
                          caption="Crystal forms of this composition in the database"
                        />
                        {k.stable?.crystal_system && (
                          <Cell
                            name="Most stable form"
                            value={`${k.stable.crystal_system}${k.stable.spacegroup ? ", " + k.stable.spacegroup : ""}`}
                            caption={`Lowest energy structure, ${k.stable.material_id}`}
                          />
                        )}
                        {k.stable?.density_gcc != null && (
                          <Cell
                            name="Published density"
                            value={k.stable.density_gcc}
                            unit="g/cm³"
                            caption={`Ours, estimated: ${sel.density_est_gcc ?? "n/a"} g/cm³`}
                          />
                        )}
                        {k.stable?.dft_shear_gpa != null && (
                          <Cell
                            name="Published shear G, DFT"
                            value={k.stable.dft_shear_gpa}
                            unit="GPa"
                            caption={`Ours, composition only: ${sel.shear_modulus_gpa} GPa`}
                            tone="accent"
                          />
                        )}
                        {k.stable?.dft_bulk_gpa != null && (
                          <Cell
                            name="Published bulk K, DFT"
                            value={k.stable.dft_bulk_gpa}
                            unit="GPa"
                            caption={`Ours, composition only: ${sel.bulk_modulus_gpa ?? "n/a"} GPa`}
                            tone="accent"
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
              </section>

              <p className="predict__note">
                Composition-only estimates. A formula does not specify crystal phase,
                microstructure, or processing. Ranges are calibrated 90 percent intervals,
                verified at 90 to 91 percent coverage on held-out materials.
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
