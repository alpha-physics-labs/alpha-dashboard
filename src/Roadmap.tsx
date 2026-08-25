/* Roadmap view. Deliberately simple. Nothing here is presented as a current
   capability, and each card says plainly what it needs before it can exist.

   One exception, and it is real: the structure model below is trained. Its
   numbers are fetched live from the API rather than typed into this file, so
   they cannot drift away from what was actually measured. */

import { useEffect, useState } from "react";
import { fetchGnnCard, type GnnCard } from "./api";

export default function Roadmap() {
  return (
    <div className="roadmap">
      <header className="roadmap__head">
        <p className="roadmap__eyebrow">Roadmap</p>
        <h1>Today we read the chemistry. Next we read the structure.</h1>
        <p>
          The structure model is trained already, and its measured results are below.
          Everything after that is not built, and each card says what it would take.
        </p>
      </header>

      {/* the headline comparison */}
      <section className="leap">
        <div className="leap__side">
          <span className="leap__tag leap__tag--now">Running today</span>
          <h2>Composition in, properties out</h2>
          <p>
            A chemical formula becomes 132 physical element quantities, and the engine predicts
            stiffness, hardness, weight, and electronic behaviour from chemistry alone.
          </p>
          <p className="leap__why">
            This is why we can answer for materials nobody has ever made. It is also the limit:
            a formula cannot tell us how the atoms are arranged.
          </p>
        </div>
        <div className="leap__arrow" aria-hidden="true">
          <span />
        </div>
        <div className="leap__side leap__side--next">
          <span className="leap__tag leap__tag--next">Next, after prototyping</span>
          <h2>Structure in, sharper answers out</h2>
          <p>
            A graph neural network reads the actual crystal: which atoms sit where, how far
            apart, how tightly packed. Geometry carries information chemistry alone cannot.
          </p>
          <p className="leap__why">
            Both heads are trained, on <b>10,987 crystal structures</b> whose 3D arrangement the
            composition engine currently throws away. What is missing is somewhere to run them.
          </p>
        </div>
      </section>

      <TrainedGnn />

      {/* what it unlocks */}
      <section className="unlock">
        <h3 className="unlock__title">What that unlocks</h3>
        <div className="unlock__grid">
          <article>
            <h4>A sharper answer when the phase is known</h4>
            <p>
              Zirconia can be monoclinic, tetragonal, or cubic, and each behaves differently.
              When the structure is known, we use it. When the composition is genuinely new, we
              fall back to chemistry with an honestly wider range.
            </p>
          </article>
          <article>
            <h4>One engine, two paths</h4>
            <p>
              The structure lookup already running in the console becomes the router: known
              crystal goes to the structure model, novel composition goes to the chemistry
              model. The user always gets an answer, and always knows which kind.
            </p>
          </article>
          <article>
            <h4>Predicting the structure itself</h4>
            <p>
              The further goal. Given a composition nobody has made, predict what crystal it
              would form, then predict its properties from that. Harder, and the natural end
              point of this direction.
            </p>
          </article>
          <article>
            <h4>Filling the empty chemistries</h4>
            <p>
              Removing an entire chemical family from training raises our error from 9.3 to
              32.5 GPa. That is a hole in the world's data, not a modelling flaw. Physics
              simulation can compute properties where nobody has measured, and fill it.
            </p>
          </article>
        </div>
        <p className="unlock__needs">
          Needs: one GPU. The data is already in hand and the models are small.
        </p>
      </section>

      {/* partner data */}
      <section className="unlock unlock--data">
        <h3 className="unlock__title">What compute cannot buy</h3>
        <div className="unlock__grid">
          <article>
            <h4>Impact energy absorption</h4>
            <p>
              The property that actually matters for helmets, pads, and protective gear. No
              public dataset exists, which is exactly why it is worth owning.
            </p>
          </article>
          <article>
            <h4>Ballistic performance</h4>
            <p>
              V50 and back face deformation against areal density. We start from an established
              analytical armor model as the physics prior and learn the correction from flat
              plate tests, the same recipe already proven on stiffness.
            </p>
          </article>
          <article>
            <h4>Polymers and composites</h4>
            <p>
              Kevlar and UHMWPE are out of scope today and labelled as such, because polymer
              strength comes from fibre processing rather than chemistry.
            </p>
          </article>
          <article>
            <h4>Fracture toughness</h4>
            <p>
              Hardness says how a material resists denting. Toughness says whether it shatters.
              It is the honest hole in our mechanical picture.
            </p>
          </article>
        </div>
        <p className="unlock__needs unlock__needs--data">
          Needs: a partner with 20 to 50 tests. Our benchmark shows physics-informed learning
          wins by up to 26 percent in exactly that range.
        </p>
      </section>

      <section className="bottleneck">
        <h3>The real bottleneck</h3>
        <p>
          Neither compute nor data is the first constraint. The technology is further along than
          the evidence that someone will pay for it. The nearest milestone is a materials
          engineer telling us what a single test costs them, and which property they would pay
          to predict.
        </p>
      </section>
    </div>
  );
}


/* The trained structure heads, read from the API so the page can never claim a
   number the engine did not actually report. Everything the model card says
   about why it is not served, and why it is not comparable, is shown too. */

function TrainedGnn() {
  const [card, setCard] = useState<GnnCard | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    fetchGnnCard()
      .then(setCard)
      .finally(() => setTried(true));
  }, []);

  if (!tried) return null;
  if (!card || card.heads.length === 0) return null;

  return (
    <section className="gnn">
      <div className="gnn__head">
        <div>
          <span className="gnn__tag">Trained, not served</span>
          <h3 className="gnn__title">What the structure model already scores</h3>
          <p className="gnn__lede">{card.why_it_matters}</p>
        </div>
        <span className="gnn__evidence">{card.evidence_status.replace("_", " ").toLowerCase()}</span>
      </div>

      <div className="gnn__heads">
        {card.heads.map((h) => (
          <article key={h.target} className="gnn__card">
            <h4>{h.target === "shear" ? "Shear modulus" : "Bulk modulus"}</h4>
            <p className="gnn__set">{h.dataset}</p>
            <div className="gnn__big">
              <b>{h.typical_factor ? `${h.typical_factor.toFixed(2)}x` : "not reported"}</b>
              <span>typical prediction lands within this factor of the truth</span>
            </div>
            <dl className="gnn__kv">
              <div><dt>Test MAE</dt><dd>{h.test_mae_log10} log10</dd></div>
              <div><dt>Structures</dt><dd>{h.n_structures?.toLocaleString()}</dd></div>
              <div><dt>Epochs</dt><dd>{h.epochs}</dd></div>
              <div><dt>Trained in</dt><dd>{h.train_minutes} min</dd></div>
            </dl>
            {h.own_evaluation && <p className="gnn__caveat">{h.own_evaluation}</p>}
          </article>
        ))}
      </div>

      <div className="gnn__why">
        <div>
          <h4>Why it is not in the product</h4>
          <ul>{card.not_served_because.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
        <div>
          <h4>Why you cannot compare it to the console</h4>
          <ul>{card.not_comparable_because.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
        <div>
          <h4>Before we publish a comparison</h4>
          <ul>{card.before_we_publish_a_comparison.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}
