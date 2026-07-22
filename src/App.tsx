import { useEffect, useState } from "react";
import Chart from "./Chart";
import Predict from "./Predict";
import { API_BASE, checkHealth, fetchModelCard, type ModelCard } from "./api";
import { PHYSICS_LAW } from "./benchmark";

const FALLBACK_CARD: ModelCard = {
  target: "shear_modulus",
  unit: "GPa",
  r2: 0.84,
  mae_gpa: 9.3,
  n_train: 7799,
  n_test: 1950,
  evidence_status: "SCREENING_ONLY",
  heads: [
    { target: "shear_modulus", unit: "GPa", r2: 0.84, mae: 9.3, n_train: 7799, n_test: 1950 },
    { target: "bulk_modulus", unit: "GPa", r2: 0.879, mae: 13.1, n_train: 7800, n_test: 1951 },
  ],
  derived: [
    "youngs_modulus (isotropic elasticity)",
    "poisson_ratio (isotropic elasticity)",
    "vickers_hardness (Chen–Niu 2011 estimate)",
    "pugh_ratio → ductile/brittle character",
  ],
};

const MARKETS = [
  {
    name: "Sports science & PPE",
    body: "Helmet liners, pads, footwear. Stiffness, hardness, and ductile/brittle screening live today; an impact-energy head is next on the same backbone.",
    market: "~$11.5B protective equipment · warm lead via NFL-helmet research",
    status: "live" as const,
  },
  {
    name: "Auto crash-worthiness & EV safety",
    body: "Crash structures trade stiffness against ductility — exactly the G, K, and Pugh-ratio screen the engine runs on any candidate alloy or composite.",
    market: "continuous new-materials testing need",
    status: "live" as const,
  },
  {
    name: "Aerospace & space infrastructure",
    body: "Stiff, light structures from a formula alone — Young's modulus and Poisson's ratio before a single coupon is machined.",
    market: "structures & composites",
    status: "live" as const,
  },
  {
    name: "Industrial tooling",
    body: "Cutting and forming tools live on the hardness–toughness frontier. The Chen–Niu hardness estimate ranks candidates before procurement.",
    market: "wear parts · dies · inserts",
    status: "live" as const,
  },
  {
    name: "Textiles & performance gear",
    body: "Rope, fabric, and gear stress-testing markets. A different property family — a scoping conversation, honestly labeled.",
    market: "exploratory",
    status: "planned" as const,
  },
  {
    name: "Defense",
    body: "Armor-material screening stays strictly screening-grade until ballistic validation. A later vertical, entered with evidence and a CRADA.",
    market: "later vertical",
    status: "planned" as const,
  },
];

function useApiStatus() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const ping = async () => {
      const ok = await checkHealth();
      setStatus(ok ? "online" : "offline");
      // The free-tier API sleeps; keep nudging it until it wakes.
      if (!ok && tries++ < 20) timer = setTimeout(ping, 15000);
    };
    ping();
    return () => clearTimeout(timer);
  }, []);
  return status;
}

export default function App() {
  const status = useApiStatus();
  const [card, setCard] = useState<ModelCard>(FALLBACK_CARD);

  useEffect(() => {
    fetchModelCard().then((c) => c && setCard(c));
  }, []);

  return (
    <div className="page">
      <header className="top">
        <div className="top__brand">
          <span className="top__alpha">α</span>
          <div>
            <b>ALPHA</b>
            <span>Material Intelligence Console</span>
          </div>
        </div>
        <div className="top__right">
          <span className={`status status--${status}`}>
            <i />
            {status === "online" ? "engine online" : status === "checking" ? "checking engine" : "engine waking"}
          </span>
          <span className="top__badge">{card.evidence_status}</span>
        </div>
      </header>

      <main>
        <section className="sec sec--hero" style={{ animationDelay: "0ms" }}>
          <p className="sec__label">01 · Predict</p>
          <h1 className="hero__h">
            Type a material.
            <br />
            <span>Get physics back.</span>
          </h1>
          <p className="hero__sub">
            Any chemical formula becomes 132 physics descriptors, two trained model heads, and
            six material properties with honest uncertainty — in about a second.
          </p>
          <Predict />
        </section>

        <section className="sec" style={{ animationDelay: "120ms" }}>
          <div className="sec__head">
            <p className="sec__label">02 · Evidence</p>
            <h2 className="sec__h">Physics helps most when data is scarce.</h2>
            <p className="sec__sub">
              Three models, same features, same held-out test set of {card.n_test.toLocaleString()}{" "}
              materials, three seeds per point. Where real impact-test data lives — 20 to 80
              samples — the physics-informed net wins.
            </p>
          </div>

          <div className="tiles">
            <div className="tile">
              <b>0.84</b>
              <span>R² on {card.n_test.toLocaleString()} unseen materials</span>
            </div>
            <div className="tile">
              <b>{card.mae_gpa} GPa</b>
              <span>mean absolute error, full model</span>
            </div>
            <div className="tile tile--hero">
              <b>−26%</b>
              <span>error vs data-only learning at 40 samples</span>
            </div>
            <div className="tile">
              <b>9,749</b>
              <span>materials merged from public sources</span>
            </div>
          </div>

          <Chart />

          <p className="law">
            The prior under the hood:&nbsp;<code>{PHYSICS_LAW}</code>&nbsp;— cohesive density does
            the heavy lifting; the network learns only the residual, constrained to obey it.
          </p>
        </section>

        <section className="sec" style={{ animationDelay: "240ms" }}>
          <div className="sec__head">
            <p className="sec__label">03 · One engine, many markets</p>
            <h2 className="sec__h">Every impact market shares the same physics.</h2>
            <p className="sec__sub">
              One featurization layer, one physics-informed core, a head per property. Training a
              new head is a week of work — not a new company.
            </p>
          </div>
          <div className="markets">
            {MARKETS.map((m) => (
              <article className={`market market--${m.status}`} key={m.name}>
                <div className="market__top">
                  <h3>{m.name}</h3>
                  <span className="market__chip">{m.status === "live" ? "screening live" : "head planned"}</span>
                </div>
                <p>{m.body}</p>
                <span className="market__foot">{m.market}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="sec" style={{ animationDelay: "360ms" }}>
          <div className="sec__head">
            <p className="sec__label">04 · Model card</p>
            <h2 className="sec__h">What this is — and what it is not.</h2>
          </div>
          <dl className="card">
            <div>
              <dt>Trained heads</dt>
              <dd>
                {(card.heads ?? []).map((h) => (
                  <span className="card__head" key={h.target}>
                    <code>{h.target}</code> — R² {h.r2} · MAE {h.mae} {h.unit} on{" "}
                    {h.n_test?.toLocaleString()} held-out materials
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>Derived by physics</dt>
              <dd>
                {(card.derived ?? []).map((d) => (
                  <span className="card__head" key={d}>
                    {d}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>Training set</dt>
              <dd>{card.n_train.toLocaleString()} materials, public data</dd>
            </div>
            <div>
              <dt>Evidence status</dt>
              <dd>
                {card.evidence_status} — decision support for which materials to test first. Not
                certified design values, not ballistic performance.
              </dd>
            </div>
            <div>
              <dt>Engine</dt>
              <dd>
                <code>{API_BASE.replace(/^https?:\/\//, "")}</code>
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="foot">
        <span>ALPHA · physics-informed material intelligence</span>
        <span>
          <a href="https://alpha-physics-labs.github.io/demo/" target="_blank" rel="noopener">
            demos
          </a>
          <a href="https://github.com/alpha-physics-labs" target="_blank" rel="noopener">
            github
          </a>
        </span>
      </footer>
    </div>
  );
}
