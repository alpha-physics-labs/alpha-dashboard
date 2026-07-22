import { useEffect, useMemo, useState } from "react";
import { API_BASE, predict, type Prediction } from "./api";

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

/* ── known-structure check (Materials Project) ── */

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

/* ── views ── */

const VIEWS = [
  { id: "ranked", label: "Ranked" },
  { id: "mechanical", label: "Mechanical" },
  { id: "impact", label: "Impact and thermal" },
  { id: "electronic", label: "Electronic" },
  { id: "known", label: "Known data" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

const VIEW_DEFS: Record<ViewId, string> = {
  ranked:
    "Materials ordered by predicted shear modulus, which measures how strongly a material resists changing shape. The line shows the prediction inside its calibrated 90 percent range.",
  mechanical:
    "How the material carries load. Trained values show a calibrated 90 percent range. The rest follow from standard elasticity relations.",
  impact:
    "Derived from the predicted moduli and element data. These are the numbers impact, armor, and lightweight design teams compare first.",
  electronic:
    "Electrical behavior from the band gap head, trained on 4,604 experimentally measured gaps.",
  known:
    "A live lookup in the Materials Project, the standard open database of computed crystals. Compare our composition-only estimate with published DFT values for the known structures.",
};

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
    <div className={`cell${tone ? ` cell--${tone}` : ""}${typeof value === "string" ? " cell--tag" : ""}`}>
      <span className="cell__name">{name}</span>
      <b className="cell__val">
        {typeof value === "number" ? value.toLocaleString() : value} {unit && <i>{unit}</i>}
      </b>
      <span className="cell__cap">{caption}</span>
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
  const [view, setView] = useState<ViewId>("ranked");
  const [known, setKnown] = useState<Record<string, KnownState>>({});

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
      setKnown({});
      setView("ranked");
    } catch {
      setError(
        "The engine could not be reached. The free tier sleeps when idle. Give it about 40 seconds to wake, then try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const valid = results?.filter((r) => r.shear_modulus_gpa !== null) ?? [];
  const failed = results?.filter((r) => r.shear_modulus_gpa === null) ?? [];
  const scaleMax = Math.max(...valid.map((r) => r.high_gpa ?? 0), 1);

  useEffect(() => {
    if (view !== "known" || valid.length === 0) return;
    for (const r of valid) {
      if (known[r.formula] !== undefined) continue;
      setKnown((k) => ({ ...k, [r.formula]: "loading" }));
      fetch(`${API_BASE}/structure?formula=${encodeURIComponent(r.formula)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((d: Known | null) =>
          setKnown((k) => ({ ...k, [r.formula]: d && d.polymorphs > 0 ? d : "none" })),
        )
        .catch(() => setKnown((k) => ({ ...k, [r.formula]: "none" })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, results]);

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
          placeholder="Type chemical formulas, like WC, TiB2, B4C"
          spellCheck={false}
          autoFocus
        />
        <button className="predict__go" type="submit" disabled={loading || !parse(input).length}>
          {loading ? "Screening" : "Screen"}
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
          Screen the classics
        </button>
      </div>

      {error && <p className="predict__error">{error}</p>}

      {loading && <PipelineLoading formulas={pending} />}

      {!loading && valid.length > 0 && (
        <div className="rview">
          <div className="seg" role="tablist">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                className={view === v.id ? "seg__btn is-on" : "seg__btn"}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <p className="rview__def">{VIEW_DEFS[view]}</p>

          <ol className="rlist">
            {valid.map((r) => {
              const k = known[r.formula];
              return (
                <li className="rrow" key={r.formula}>
                  <header className="rrow__head">
                    <span className="rrow__rank">
                      {String(r.rank).padStart(2, "0")}
                    </span>
                    <span className="rrow__formula">{r.formula}</span>
                    {r.domain && (
                      <span
                        className={`rrow__tag ${
                          r.domain === "in_domain" ? "rrow__tag--in" : "rrow__tag--out"
                        }`}
                      >
                        {r.domain === "in_domain" ? "In domain" : "Extrapolating"}
                      </span>
                    )}
                    <span className="rrow__badge">Screening only</span>
                  </header>

                  {view === "ranked" && (
                    <>
                      <div className="rbar">
                        <div className="rbar__track">
                          <i
                            className="rbar__band"
                            style={{
                              left: `${Math.max(((r.low_gpa ?? 0) / scaleMax) * 100, 0)}%`,
                              width: `${(((r.high_gpa ?? 0) - Math.max(r.low_gpa ?? 0, 0)) / scaleMax) * 100}%`,
                            }}
                          />
                          <i
                            className="rbar__fill"
                            style={{ width: `${((r.shear_modulus_gpa ?? 0) / scaleMax) * 100}%` }}
                          />
                        </div>
                        <span className="rbar__val">
                          {r.shear_modulus_gpa} GPa{" "}
                          <em>± {r.shear_conformal90_gpa ?? r.uncertainty_gpa} at 90 percent</em>
                        </span>
                      </div>
                      {r.neighbors && r.neighbors.length > 0 && (
                        <p className="rrow__nbrs">
                          Closest training materials:{" "}
                          {r.neighbors.map((n, i) => (
                            <span key={n.formula + i}>
                              {i > 0 && ", "}
                              <code>{n.formula}</code> {n.shear_modulus_gpa} GPa
                            </span>
                          ))}{" "}
                          (measured)
                        </p>
                      )}
                    </>
                  )}

                  {view === "mechanical" && (
                    <div className="pgrid">
                      <Cell
                        name="Shear modulus G"
                        value={r.shear_modulus_gpa ?? 0}
                        unit={`GPa ± ${r.shear_conformal90_gpa ?? r.uncertainty_gpa}`}
                        caption="Resistance to changing shape"
                      />
                      {r.bulk_modulus_gpa != null && (
                        <Cell
                          name="Bulk modulus K"
                          value={r.bulk_modulus_gpa}
                          unit={`GPa ± ${r.bulk_conformal90_gpa ?? r.bulk_uncertainty_gpa}`}
                          caption="Resistance to compression"
                        />
                      )}
                      {r.youngs_modulus_gpa != null && (
                        <Cell
                          name="Young's modulus E"
                          value={r.youngs_modulus_gpa}
                          unit="GPa"
                          caption="Stiffness in a pull test, from K and G"
                        />
                      )}
                      {r.poisson_ratio != null && (
                        <Cell
                          name="Poisson's ratio ν"
                          value={r.poisson_ratio}
                          caption="Sideways spread when stretched"
                        />
                      )}
                      {r.vickers_hardness_gpa != null && (
                        <Cell
                          name="Estimated hardness"
                          value={r.vickers_hardness_gpa}
                          unit="GPa"
                          caption="Scratch and dent resistance, Chen-Niu estimate, not a test"
                        />
                      )}
                      {r.character && (
                        <Cell
                          name="Pugh tendency"
                          value={r.character}
                          caption="Leaning toward brittle or tougher failure, an indicator only"
                          tone={r.character === "less brittle" ? "good" : "warn"}
                        />
                      )}
                    </div>
                  )}

                  {view === "impact" && (
                    <div className="pgrid">
                      {r.density_est_gcc != null && (
                        <Cell
                          name="Density, estimated"
                          value={r.density_est_gcc}
                          unit="g/cm³"
                          caption="Weight per volume, from element data"
                        />
                      )}
                      {r.specific_stiffness_gpa_gcc != null && (
                        <Cell
                          name="Specific stiffness E/ρ"
                          value={r.specific_stiffness_gpa_gcc}
                          unit="GPa·cm³/g"
                          caption="Stiffness per unit weight, key for light structures"
                        />
                      )}
                      {r.sound_speed_shear_ms != null && (
                        <Cell
                          name="Shear wave speed"
                          value={r.sound_speed_shear_ms}
                          unit="m/s"
                          caption="How fast a shape wave travels through it"
                        />
                      )}
                      {r.sound_speed_long_ms != null && (
                        <Cell
                          name="Pressure wave speed"
                          value={r.sound_speed_long_ms}
                          unit="m/s"
                          caption="How fast a compression wave travels"
                        />
                      )}
                      {r.acoustic_impedance_mrayl != null && (
                        <Cell
                          name="Acoustic impedance"
                          value={r.acoustic_impedance_mrayl}
                          unit="MRayl"
                          caption="How it passes or reflects shock, used to layer armor"
                          tone="accent"
                        />
                      )}
                      {r.kmin_clarke_w_mk != null && (
                        <Cell
                          name="Minimum heat flow"
                          value={r.kmin_clarke_w_mk}
                          unit="W/m·K"
                          caption="Lower bound on thermal conductivity, Clarke model"
                        />
                      )}
                    </div>
                  )}

                  {view === "electronic" && (
                    <div className="pgrid">
                      {r.band_gap_ev != null && (
                        <Cell
                          name="Band gap"
                          value={r.band_gap_ev}
                          unit={`eV ± ${r.band_gap_conformal90_ev ?? r.band_gap_uncertainty_ev}`}
                          caption="Energy gap that sets electrical behavior"
                        />
                      )}
                      {r.electronic_class && (
                        <Cell
                          name="Electronic class"
                          value={r.electronic_class}
                          caption="Metal conducts, semiconductor switches, insulator blocks"
                          tone="accent"
                        />
                      )}
                    </div>
                  )}

                  {view === "known" && (
                    <div className="pgrid">
                      {k === "loading" || k === undefined ? (
                        <Cell name="Materials Project" value="Looking up" caption="Querying known crystal structures" />
                      ) : k === "none" ? (
                        <Cell
                          name="Materials Project"
                          value="No entry"
                          caption="No known crystal for this composition. Our estimate is the only number available."
                        />
                      ) : (
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
                              caption={`Ours, estimated: ${r.density_est_gcc ?? "n/a"} g/cm³`}
                            />
                          )}
                          {k.stable?.dft_shear_gpa != null && (
                            <Cell
                              name="Published shear G, DFT"
                              value={k.stable.dft_shear_gpa}
                              unit="GPa"
                              caption={`Ours, composition only: ${r.shear_modulus_gpa} GPa`}
                              tone="accent"
                            />
                          )}
                          {k.stable?.dft_bulk_gpa != null && (
                            <Cell
                              name="Published bulk K, DFT"
                              value={k.stable.dft_bulk_gpa}
                              unit="GPa"
                              caption={`Ours, composition only: ${r.bulk_modulus_gpa ?? "n/a"} GPa`}
                              tone="accent"
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {!loading && failed.length > 0 && (
        <p className="predict__failed">
          Not recognised: {failed.map((r) => r.formula).join(", ")}. Check the chemistry.
        </p>
      )}

      {!loading && valid.length > 0 && (
        <p className="predict__note">
          These are composition-only estimates. A formula does not specify crystal phase,
          microstructure, or processing. The ± values are calibrated 90 percent ranges,
          verified at 90 to 91 percent coverage on held-out materials. Hardness is a Chen-Niu
          estimate, not an indentation test. Use the Known data tab to compare with published
          values.
        </p>
      )}
    </div>
  );
}
