/* Roadmap view. Everything here is clearly separated into what runs today,
   what compute unlocks, and what partner data unlocks. Nothing on this page
   is presented as a current capability. */

type Item = { title: string; body: string; needs?: string };

const SHIPPED: Item[] = [
  {
    title: "Three trained property heads",
    body: "Shear modulus, bulk modulus, and band gap, learned from 9,749 public materials. Splits are grouped by formula, so no composition appears in both training and testing.",
  },
  {
    title: "Calibrated confidence",
    body: "Every value carries a 90 percent range, calibrated on held-out materials and verified at 90 to 91 percent actual coverage on data the models never saw.",
  },
  {
    title: "Honest scope flags",
    body: "In domain, extrapolating, or out of scope. The engine refuses to answer for polymers rather than returning a confident wrong number.",
  },
  {
    title: "Physics-derived properties",
    body: "Young's modulus, Poisson's ratio, intrinsic hardness, density, wave speeds, shock impedance, and panel areal density, all from exact classical relations rather than guessed by a model.",
  },
  {
    title: "Live comparison with published data",
    body: "Each prediction is checked against the Materials Project record for the known crystal, so agreement with published science is visible rather than claimed.",
  },
];

const COMPUTE: Item[] = [
  {
    title: "Structure-aware graph networks",
    body: "We already hold 10,987 crystal structures whose 3D arrangement we currently discard, keeping only the chemical formula. A graph network trained on those structures is the largest accuracy gain available to us, and it answers the criticism that a formula alone cannot distinguish one crystal phase from another.",
    needs: "One GPU, hours of training, data already in hand",
  },
  {
    title: "A two-path engine",
    body: "When a crystal structure is known, route the prediction through the structure model for a tighter answer. When the composition is genuinely new and no structure exists, fall back to the composition engine with a wider, honest range. The structure lookup that powers this router is already running in the console today.",
    needs: "Follows directly from the model above",
  },
  {
    title: "Simulation to fill data gaps",
    body: "Removing an entire chemical family from training raises error from 9.3 to 32.5 GPa. That is not a modelling flaw, it is a hole in the world's data. Fast interatomic potentials let us compute physically grounded properties for chemistries nobody has measured or calculated, filling those holes without a laboratory.",
    needs: "Sustained GPU capacity",
  },
  {
    title: "Larger ensembles",
    body: "More models voting means narrower calibrated intervals, which the customer sees directly as a more decisive answer.",
    needs: "Modest additional compute",
  },
];

const DATA: Item[] = [
  {
    title: "Impact energy head",
    body: "The property that actually matters for helmets, pads, and protective gear. No public dataset exists, which is precisely why it is worth owning. Our benchmark shows physics-informed learning wins by up to 26 percent in the 20 to 80 sample range, which is the size of a real test campaign.",
    needs: "A partner with 20 to 50 impact tests",
  },
  {
    title: "Ballistic performance",
    body: "Predicted V50 and back face deformation against areal density. The approach starts from an established analytical armor model as the physics prior and trains the network on the correction between theory and observed results, the same recipe already proven on stiffness.",
    needs: "Flat plate test data and the program's accepted analytical baseline",
  },
  {
    title: "Polymer and composite head",
    body: "Kevlar and UHMWPE are out of scope today and labeled as such, because polymer strength comes from fiber processing and chain alignment rather than chemistry. Covering them requires data that ties processing to performance, not a bigger model.",
    needs: "Processing-linked test data from a manufacturer",
  },
  {
    title: "Fracture toughness",
    body: "Hardness tells you how a material resists denting. Toughness tells you whether it shatters. It is the honest hole in our mechanical picture and the natural first ask in any protection conversation.",
    needs: "Partner or literature toughness data",
  },
];

function Stage({
  label,
  status,
  note,
  items,
}: {
  label: string;
  status: "live" | "planned";
  note: string;
  items: Item[];
}) {
  return (
    <section className={`stage stage--${status}`}>
      <header className="stage__head">
        <h2>{label}</h2>
        <span className={`rrow__tag ${status === "live" ? "rrow__tag--in" : "rrow__tag--out"}`}>
          {status === "live" ? "Deployed" : "Not built yet"}
        </span>
      </header>
      <p className="stage__note">{note}</p>
      <div className="stage__items">
        {items.map((it) => (
          <article className="ritem" key={it.title}>
            <h3>{it.title}</h3>
            <p>{it.body}</p>
            {it.needs && <span className="ritem__needs">Requires: {it.needs}</span>}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Roadmap() {
  return (
    <div className="roadmap">
      <header className="roadmap__head">
        <h1>Where ALPHA goes next</h1>
        <p>
          Everything below is separated into what runs today, what more compute would
          unlock, and what only partner data can unlock. Nothing in the planned sections is
          a current capability.
        </p>
      </header>

      <Stage
        label="Running today"
        status="live"
        note="Built and deployed. Every claim here is visible in the console."
        items={SHIPPED}
      />

      <Stage
        label="What GPU compute unlocks"
        status="planned"
        note="We are not compute limited for what runs today. Our models train on a laptop. Compute unlocks a different class of model, and the data for it is already in hand."
        items={COMPUTE}
      />

      <Stage
        label="What partner data unlocks"
        status="planned"
        note="These cannot be bought with compute at any scale. They need measurements that exist only inside a partner organisation, which is exactly what makes them defensible once we have them."
        items={DATA}
      />

      <section className="stage stage--plain">
        <header className="stage__head">
          <h2>The real bottleneck</h2>
        </header>
        <p className="stage__note">
          Neither compute nor data is the first constraint. The technology is further along
          than the evidence that someone will pay for it. The nearest milestone is a
          materials engineer telling us what a single test costs them and which property
          they would pay to predict.
        </p>
      </section>
    </div>
  );
}
