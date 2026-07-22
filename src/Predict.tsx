import { useEffect, useMemo, useState } from "react";
import { predict, type Prediction } from "./api";

const PRESETS = ["WC", "TiB2", "B4C", "SiC", "Al2O3", "Si", "GaAs", "ZrO2"];
const CLASSICS = "WC TiB2 B4C SiC Al2O3";

function parse(input: string): string[] {
  return [...new Set(input.split(/[\s,;]+/).filter(Boolean))].slice(0, 25);
}

/* ── pipeline animation: the real inference steps, visualized ── */

const STEPS = [
  "parsing compositions",
  "computing elemental descriptors",
  "assembling the 132-dimension feature vector",
  "evaluating trained heads · G, K, band gap",
  "applying elasticity relations · E, ν, Hᵥ, Pugh",
  "classifying electronic character",
];
const STEP_MS = 900;
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
  "space-group statistics",
  "s/p/d/f occupancy",
];

const HEAD_NODES = ["shear G", "bulk K", "band gap"];

function parseElements(formulas: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const f of formulas) {
    for (const m of f.matchAll(/([A-Z][a-z]?)(\d*\.?\d*)/g)) {
      const n = m[2] ? parseFloat(m[2]) : 1;
      counts.set(m[1], (counts.get(m[1]) ?? 0) + n);
    }
  }
  return [...counts.entries()].slice(0, 12);
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
          {elements.map(([sym], i) => (
            <span className="el" key={sym} style={{ animationDelay: `${i * 110}ms` }}>
              <b>{sym}</b>
              <i className="el__orbit" aria-hidden="true" />
              <i className="el__orbit el__orbit--2" aria-hidden="true" />
            </span>
          ))}
        </div>
        <ol className="pload__steps">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={i < step ? "is-done" : i === step ? "is-active" : ""}
            >
              <i />
              {s}
              {i === 1 && i === step && (
                <em> — {DESCRIPTORS[tick % DESCRIPTORS.length]}</em>
              )}
            </li>
          ))}
        </ol>
        {step >= 4 && (
          <p className="pload__eq">
            E = 9KG / (3K + G) &nbsp;·&nbsp; ν = (3K − 2G) / 2(3K + G) &nbsp;·&nbsp; Hᵥ =
            2(k²G)<sup>0.585</sup> − 3
          </p>
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
          {HEAD_NODES.map((h, i) => (
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

/* ── main panel ── */

export default function Predict() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Prediction[] | null>(null);

  const run = async (raw: string) => {
    const formulas = parse(raw);
    if (formulas.length === 0 || loading) return;
    setLoading(true);
    setPending(formulas);
    setError(null);
    const started = Date.now();
    try {
      const res = await predict(formulas);
      // Let the pipeline animation finish its story before the results land.
      const remaining = MIN_SHOW_MS - (Date.now() - started);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setResults(res);
    } catch {
      setError(
        "Couldn't reach the engine. The free-tier API sleeps when idle — give it ~40 seconds to wake, then try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const valid = results?.filter((r) => r.shear_modulus_gpa !== null) ?? [];
  const failed = results?.filter((r) => r.shear_modulus_gpa === null) ?? [];
  const scaleMax = Math.max(...valid.map((r) => r.high_gpa ?? 0), 1);

  return (
    <div className="predict">
      <form
        className="predict__form"
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
      >
        <input
          className="predict__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type chemical formulas — WC, TiB2, B4C…"
          spellCheck={false}
          autoFocus
        />
        <button className="predict__go" type="submit" disabled={loading || !parse(input).length}>
          {loading ? "Screening…" : "Screen"}
        </button>
      </form>

      <div className="predict__chips">
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
          Screen the classics →
        </button>
      </div>

      {error && <p className="predict__error">{error}</p>}

      {loading && <PipelineLoading formulas={pending} />}

      {!loading && valid.length > 0 && (
        <ol className="results">
          {valid.map((r) => {
            const lo = ((r.low_gpa ?? 0) / scaleMax) * 100;
            const hi = ((r.high_gpa ?? 0) / scaleMax) * 100;
            const mid = ((r.shear_modulus_gpa ?? 0) / scaleMax) * 100;
            return (
              <li className="result" key={r.formula}>
                <div className="result__main">
                  <span className="result__rank">{r.rank}</span>
                  <span className="result__formula">{r.formula}</span>
                  <span className="result__bar" aria-hidden="true">
                    <i
                      className="result__band"
                      style={{ left: `${Math.max(lo, 0)}%`, width: `${hi - Math.max(lo, 0)}%` }}
                    />
                    <i className="result__dot" style={{ left: `${mid}%` }} />
                  </span>
                  <span className="result__val">
                    {r.shear_modulus_gpa}
                    <em> GPa · 90% ± {r.shear_conformal90_gpa ?? r.uncertainty_gpa}</em>
                  </span>
                  <span className="result__badge">{r.evidence_status ?? "SCREENING_ONLY"}</span>
                </div>
                <div className="result__props">
                  {r.domain && (
                    <span
                      className={`prop prop--tag ${
                        r.domain === "in_domain" ? "prop--ductile" : "prop--brittle"
                      }`}
                    >
                      <b>{r.domain === "in_domain" ? "in domain" : "extrapolating"}</b>
                    </span>
                  )}
                  <span className="prop">
                    <label>shear G</label>
                    <b>
                      {r.shear_modulus_gpa} <i>GPa · ±{r.shear_conformal90_gpa ?? r.uncertainty_gpa}</i>
                    </b>
                  </span>
                  {r.bulk_modulus_gpa != null && (
                    <span className="prop">
                      <label>bulk K</label>
                      <b>
                        {r.bulk_modulus_gpa} <i>GPa · ±{r.bulk_conformal90_gpa ?? r.bulk_uncertainty_gpa}</i>
                      </b>
                    </span>
                  )}
                  {r.youngs_modulus_gpa != null && (
                    <span className="prop">
                      <label>Young's E</label>
                      <b>
                        {r.youngs_modulus_gpa} <i>GPa</i>
                      </b>
                    </span>
                  )}
                  {r.poisson_ratio != null && (
                    <span className="prop">
                      <label>Poisson ν</label>
                      <b>{r.poisson_ratio}</b>
                    </span>
                  )}
                  {r.vickers_hardness_gpa != null && (
                    <span className="prop">
                      <label>est. hardness Hᵥ</label>
                      <b>
                        {r.vickers_hardness_gpa} <i>GPa</i>
                      </b>
                    </span>
                  )}
                  {r.band_gap_ev != null && (
                    <span className="prop">
                      <label>band gap</label>
                      <b>
                        {r.band_gap_ev} <i>eV · ±{r.band_gap_conformal90_ev ?? r.band_gap_uncertainty_ev}</i>
                      </b>
                    </span>
                  )}
                  {r.electronic_class && (
                    <span className={`prop prop--tag prop--elec`}>
                      <b>{r.electronic_class}</b>
                    </span>
                  )}
                  {r.character && (
                    <span
                      className={`prop prop--tag ${
                        r.character === "less brittle" ? "prop--ductile" : "prop--brittle"
                      }`}
                    >
                      <label>Pugh</label>
                      <b>{r.character}</b>
                    </span>
                  )}
                </div>
                {(r.density_est_gcc != null || r.acoustic_impedance_mrayl != null) && (
                  <div className="result__props result__props--impact">
                    {r.density_est_gcc != null && (
                      <span className="prop">
                        <label>ρ est.</label>
                        <b>
                          {r.density_est_gcc} <i>g/cm³</i>
                        </b>
                      </span>
                    )}
                    {r.specific_stiffness_gpa_gcc != null && (
                      <span className="prop">
                        <label>E/ρ</label>
                        <b>
                          {r.specific_stiffness_gpa_gcc} <i>GPa·cm³/g</i>
                        </b>
                      </span>
                    )}
                    {r.sound_speed_shear_ms != null && (
                      <span className="prop">
                        <label>shear wave vₛ</label>
                        <b>
                          {r.sound_speed_shear_ms.toLocaleString()} <i>m/s</i>
                        </b>
                      </span>
                    )}
                    {r.acoustic_impedance_mrayl != null && (
                      <span className="prop">
                        <label>impedance Z</label>
                        <b>
                          {r.acoustic_impedance_mrayl} <i>MRayl</i>
                        </b>
                      </span>
                    )}
                    {r.kmin_clarke_w_mk != null && (
                      <span className="prop">
                        <label>κ min (Clarke)</label>
                        <b>
                          {r.kmin_clarke_w_mk} <i>W/m·K</i>
                        </b>
                      </span>
                    )}
                  </div>
                )}
                {r.neighbors && r.neighbors.length > 0 && (
                  <p className="result__nbrs">
                    nearest training materials:{" "}
                    {r.neighbors.map((n, i) => (
                      <span key={n.formula + i}>
                        {i > 0 && " · "}
                        <code>{n.formula}</code> {n.shear_modulus_gpa} GPa
                      </span>
                    ))}{" "}
                    <em>(measured)</em>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!loading && failed.length > 0 && (
        <p className="predict__failed">
          Not recognised: {failed.map((r) => r.formula).join(", ")} — check the chemistry.
        </p>
      )}

      {!loading && valid.length > 0 && (
        <p className="predict__note">
          Composition-only estimates, ranked by shear modulus — a formula does not specify
          crystal phase, microstructure, or processing. The ± values are split-conformal 90%
          intervals: calibrated so 90% of held-out materials land inside, and verified at
          90–91% coverage on the test set. Hardness is the Chen–Niu intrinsic estimate, not an
          indentation test; the Pugh tag is a brittleness-tendency indicator; density and the
          impact row are physics-derived from element data and the predicted moduli.
        </p>
      )}
    </div>
  );
}
