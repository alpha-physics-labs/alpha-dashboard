import { useState } from "react";
import { predict, type Prediction } from "./api";

const PRESETS = ["WC", "TiB2", "B4C", "SiC", "Al2O3", "Si3N4", "TiC", "ZrB2"];
const CLASSICS = "WC TiB2 B4C SiC Al2O3";

function parse(input: string): string[] {
  return [...new Set(input.split(/[\s,;]+/).filter(Boolean))].slice(0, 25);
}

export default function Predict() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Prediction[] | null>(null);

  const run = async (raw: string) => {
    const formulas = parse(raw);
    if (formulas.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await predict(formulas));
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

      {loading && (
        <div className="predict__loading">
          featurizing composition → 132 physics descriptors → model
          <span className="dots" aria-hidden="true" />
        </div>
      )}

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
                    <em> ± {r.uncertainty_gpa} GPa</em>
                  </span>
                  <span className="result__badge">{r.evidence_status ?? "SCREENING_ONLY"}</span>
                </div>
                <div className="result__props">
                  <span className="prop">
                    <label>shear G</label>
                    <b>
                      {r.shear_modulus_gpa} <i>±{r.uncertainty_gpa}</i>
                    </b>
                  </span>
                  {r.bulk_modulus_gpa != null && (
                    <span className="prop">
                      <label>bulk K</label>
                      <b>
                        {r.bulk_modulus_gpa} <i>±{r.bulk_uncertainty_gpa}</i>
                      </b>
                    </span>
                  )}
                  {r.youngs_modulus_gpa != null && (
                    <span className="prop">
                      <label>Young's E</label>
                      <b>{r.youngs_modulus_gpa}</b>
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
                      <label>hardness Hᵥ</label>
                      <b>{r.vickers_hardness_gpa}</b>
                    </span>
                  )}
                  {r.character && (
                    <span className={`prop prop--tag prop--${r.character}`}>
                      <b>{r.character}</b>
                    </span>
                  )}
                </div>
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
          Ranked by shear modulus, screening grade. Two trained heads (G, K) carry honest
          test-set uncertainty; Young's E, Poisson ν, hardness, and ductile/brittle character
          follow from them by exact elasticity relations and Chen–Niu.
        </p>
      )}
    </div>
  );
}
