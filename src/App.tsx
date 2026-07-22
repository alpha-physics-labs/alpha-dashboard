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
    { target: "shear_modulus", unit: "GPa", r2: 0.844, mae: 9.29, n_train: 6628, n_test: 1950 },
    { target: "bulk_modulus", unit: "GPa", r2: 0.878, mae: 13.18, n_train: 6630, n_test: 1951 },
    { target: "band_gap", unit: "eV", r2: 0.701, mae: 0.44, n_train: 3130, n_test: 921 },
  ],
};

const MARKETS = [
  {
    name: "Sports and impact protection",
    body: "Helmet liners, pads, footwear. Stiffness, estimated hardness, and impedance screening today. An impact energy head comes next on the same engine.",
    market: "Protective equipment, warm lead via NFL helmet research",
    status: "live" as const,
  },
  {
    name: "Auto crash and EV safety",
    body: "Crash structures trade stiffness against toughness. That is exactly the modulus and Pugh screen the engine runs on any candidate alloy.",
    market: "Continuous new materials testing need",
    status: "live" as const,
  },
  {
    name: "Aerospace and space",
    body: "Stiff, light structures from a formula alone. Specific stiffness and wave speeds before a single coupon is machined.",
    market: "Structures and composites",
    status: "live" as const,
  },
  {
    name: "Industrial tooling",
    body: "Cutting and forming tools live on the hardness and toughness frontier. The hardness estimate ranks candidates before procurement.",
    market: "Wear parts, dies, inserts",
    status: "live" as const,
  },
  {
    name: "Semiconductors and energy",
    body: "The band gap head, trained on measured gaps, classifies metal, semiconductor, or insulator from a formula. It was trained during this build day.",
    market: "Electronic materials",
    status: "live" as const,
  },
  {
    name: "Defense",
    body: "Armor material screening stays strictly screening grade until ballistic validation. A later vertical, entered with evidence.",
    market: "Later vertical",
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
          <img
            className="top__logo"
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="ALPHA logo"
          />
          <div>
            <b>ALPHA</b>
            <span>Material Intelligence Console</span>
          </div>
        </div>
        <div className="top__right">
          <span className={`status status--${status}`}>
            <i />
            {status === "online"
              ? "Engine online"
              : status === "checking"
                ? "Checking engine"
                : "Engine waking"}
          </span>
          <span className="top__badge">Screening only</span>
        </div>
      </header>

      <main>
        <section className="sec sec--hero">
          <p className="sec__label">01 · Predict</p>
          <h1 className="hero__h">
            <span className="wline" style={{ animationDelay: "60ms" }}>
              Type a material.
            </span>
            <span className="wline wline--accent" style={{ animationDelay: "200ms" }}>
              Get physics back.
            </span>
          </h1>
          <p className="hero__sub">
            Enter a chemical formula. The engine builds 132 composition descriptors, runs three
            trained heads for shear, bulk, and band gap, then derives the rest with classical
            physics. Every value carries a calibrated 90 percent range.
          </p>
          <Predict />
        </section>

        <section className="sec">
          <div className="sec__head">
            <p className="sec__label">02 · The physics</p>
            <h2 className="sec__h">Physics-informed is the product.</h2>
            <p className="sec__sub">
              Physics enters in three places, each one checkable. Then the proof: three models,
              same features, same held-out test set of {card.n_test.toLocaleString()} materials.
              In the range where real impact test data lives, 20 to 80 samples, the
              physics-informed net wins.
            </p>
          </div>

          <div className="phys">
            <article>
              <h4>Physical quantities in</h4>
              <p>
                Every formula becomes 132 physical element quantities: electronegativity, atomic
                volume, valence electrons, melting point. No black box inputs.
              </p>
            </article>
            <article>
              <h4>A physical law as the prior</h4>
              <p>
                A scaling law for stiffness anchors learning. The network learns only the
                correction to the law, and gradient constraints keep its behavior physically
                monotone.
              </p>
            </article>
            <article>
              <h4>Exact physics out</h4>
              <p>
                Young's modulus, Poisson's ratio, wave speeds, impedance, and minimum heat flow
                come from exact classical relations, never guessed by the model.
              </p>
            </article>
          </div>

          <div className="tiles">
            <div className="tile">
              <b>0.84</b>
              <span>R² on {card.n_test.toLocaleString()} unseen materials</span>
            </div>
            <div className="tile">
              <b>90 to 91%</b>
              <span>measured coverage of the calibrated 90 percent ranges</span>
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
            The prior under the hood: <code>{PHYSICS_LAW}</code>. Cohesive density does the heavy
            lifting. The network learns only the residual, constrained to obey it.
          </p>
          <p className="law">
            Straight answer for the technical reader: the live screening heads are gradient
            boosted models over the physical descriptors, because data is plentiful for these
            three properties. The physics-informed network above is our engine for the scarce
            data regime, which is where customer impact data actually lives. Same features,
            physics added exactly where it pays.
          </p>
          <p className="law">
            Out-of-distribution honesty. Remove an entire chemical family from training and
            predict it cold, shear MAE: all borides <b>32.5</b>, all tungsten compounds{" "}
            <b>17.8</b>, all zirconium compounds <b>11.5</b>, versus <b>9.3</b> GPa in domain.
            Truly novel chemistry is harder. That is why every prediction carries an in-domain or
            extrapolating flag.
          </p>
        </section>

        <section className="sec">
          <div className="sec__head">
            <p className="sec__label">03 · One engine, many markets</p>
            <h2 className="sec__h">One engine. A property head per market.</h2>
            <p className="sec__sub">
              Several materials markets share the same property foundations. Each application
              still needs its own data and validation. The engine makes adding that head a week
              of work, not a new company. The band gap head was trained today to prove it.
            </p>
          </div>
          <div className="markets">
            {MARKETS.map((m) => (
              <article className={`market market--${m.status}`} key={m.name}>
                <div className="market__top">
                  <h3>{m.name}</h3>
                  <span className="market__chip">
                    {m.status === "live" ? "Screening live" : "Planned"}
                  </span>
                </div>
                <p>{m.body}</p>
                <span className="market__foot">{m.market}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="sec">
          <div className="sec__head">
            <p className="sec__label">04 · Model card</p>
            <h2 className="sec__h">What this is, and what it is not.</h2>
          </div>
          <dl className="card">
            <div>
              <dt>Trained heads</dt>
              <dd>
                {(card.heads ?? []).map((h) => (
                  <span className="card__head" key={h.target}>
                    <code>{h.target}</code>: R² {h.r2}, MAE {h.mae} {h.unit} on{" "}
                    {h.n_test?.toLocaleString()} held-out materials
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>Derived by physics</dt>
              <dd>
                Young's modulus, Poisson's ratio, estimated hardness (Chen-Niu), Pugh tendency,
                density estimate, wave speeds, acoustic impedance, minimum thermal conductivity
                (Clarke), electronic class. Each is labeled on the prediction itself.
              </dd>
            </div>
            <div>
              <dt>Uncertainty</dt>
              <dd>
                Calibrated 90 percent ranges per head: G ±23.0 GPa, K ±30.3 GPa, gap ±1.21 eV.
                Verified on the untouched test set at 90.1 to 91.0 percent coverage.
              </dd>
            </div>
            <div>
              <dt>Data and splits</dt>
              <dd>
                Public data, mixed experimental and computed. Splits are grouped by formula, so
                no composition appears in both train and test.
              </dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>
                Composition-only estimates. A formula does not specify crystal phase,
                microstructure, temperature, or processing. Use the Known data tab to compare
                with published structures.
              </dd>
            </div>
            <div>
              <dt>Purpose</dt>
              <dd>
                Decision support for choosing which materials to test first. Not certified design
                values, not ballistic performance.
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
