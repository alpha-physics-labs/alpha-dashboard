/* Impact workspace: the second engine.
 *
 * A closed-cell foam pad, a flat impactor, and the whole deceleration pulse
 * that comes out. No trees and no training set here: this is Gibson-Ashby
 * cellular scaling plus a three-stage crush law, nine constants fitted once
 * against STAR Lab drop-tower data and then held fixed.
 *
 * Held-out accuracy is 26.9% on peak G (fit two foam grades, predict the third
 * cold), against 56.1% for the standard desk method. Both numbers are on the
 * page, because a prediction without its error is a decoration. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { simulateImpact, type ImpactResult } from "./api";

type Inputs = {
  density: number;
  thickness: number;
  diameter: number;
  mass: number;
  drive: "height" | "velocity";
  height: number;
  velocity: number;
  prior: number;
};

const START: Inputs = {
  density: 125,
  thickness: 25.4,
  diameter: 50.8,
  mass: 5,
  drive: "height",
  height: 0.3,
  velocity: 3,
  prior: 0,
};

/* The three grades Dr. Piland actually tested. Everything else is the model
   reasoning about a foam nobody has put on a drop tower. */
const GRADES = [
  { name: "VN600", density: 97.5, note: "lightest tested" },
  { name: "VN740", density: 125, note: "middle grade" },
  { name: "VN1000", density: 183, note: "densest tested" },
];

const fmt = (v: number, d = 1) =>
  v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

/* ── the pulse chart ───────────────────────────────────────────────────── */

const W = 720;
const H = 300;
const PAD = { l: 54, r: 18, t: 22, b: 40 };

function Pulse({ res }: { res: ImpactResult }) {
  const { t_ms, accel_g } = res.curve;
  const tMax = t_ms[t_ms.length - 1] || 1;
  // Headroom for the uncertainty corridor too, or the top of the band clips off.
  const gMax = Math.max(...accel_g, res.peak_high_g, 1) * 1.1;

  const x = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r);
  const y = (g: number) => H - PAD.b - (g / gMax) * (H - PAD.t - PAD.b);

  const line = t_ms.map((t, i) => `${i ? "L" : "M"}${x(t).toFixed(1)} ${y(accel_g[i]).toFixed(1)}`).join(" ");
  const area = `${line} L${x(tMax).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;

  const peakI = accel_g.indexOf(Math.max(...accel_g));
  const px = x(t_ms[peakI]);
  const py = y(accel_g[peakI]);
  const flip = px > W - 150;

  const gTicks = ticks(gMax, 4);
  const tTicks = ticks(tMax, 5);

  return (
    <svg className="imp__svg" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Deceleration pulse peaking at ${res.peak_g} G after ${res.contact_ms} milliseconds of contact.`}>
      {gTicks.map((g) => (
        <g key={g}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} className="imp__grid" />
          <text x={PAD.l - 9} y={y(g) + 4} className="imp__tick" textAnchor="end">{g}</text>
        </g>
      ))}
      {tTicks.map((t) => (
        <text key={t} x={x(t)} y={H - PAD.b + 18} className="imp__tick" textAnchor="middle">{t}</text>
      ))}

      {/* the 90% band on the peak, drawn as a horizontal corridor */}
      <rect x={PAD.l} y={y(res.peak_high_g)} width={W - PAD.l - PAD.r}
        height={Math.max(y(res.peak_low_g) - y(res.peak_high_g), 1)} className="imp__band" />

      <path d={area} className="imp__fill" />
      <path d={line} className="imp__line" />

      <line x1={px} x2={px} y1={py} y2={H - PAD.b} className="imp__peakline" />
      <circle cx={px} cy={py} r={4.5} className="imp__peakdot" />
      <text x={flip ? px - 10 : px + 10} y={py - 9} className="imp__peaklabel"
        textAnchor={flip ? "end" : "start"}>
        {fmt(res.peak_g)} G
      </text>

      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="imp__axis" />
      <text x={PAD.l} y={16} className="imp__axtitle">deceleration, G</text>
      <text x={W - PAD.r} y={H - 6} className="imp__axtitle" textAnchor="end">time in contact, ms</text>
    </svg>
  );
}

function ticks(max: number, n: number): number[] {
  const raw = max / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = step; v < max; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/* ── the workspace ─────────────────────────────────────────────────────── */

export default function Impact() {
  const [inp, setInp] = useState<Inputs>(START);
  const [res, setRes] = useState<ImpactResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const seq = useRef(0);

  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setInp((p) => ({ ...p, [k]: v }));

  const run = useCallback(async (v: Inputs) => {
    const id = ++seq.current;
    setBusy(true);
    try {
      const out = await simulateImpact({
        density_kg_m3: v.density,
        thickness_mm: v.thickness,
        diameter_mm: v.diameter,
        impactor_mass_kg: v.mass,
        drop_height_m: v.drive === "height" ? v.height : null,
        impact_velocity_ms: v.drive === "velocity" ? v.velocity : null,
        prior_strain: v.prior,
      });
      if (id !== seq.current) return;
      setRes(out);
      setErr(null);
    } catch (e) {
      if (id !== seq.current) return;
      setErr(e instanceof Error ? e.message : "The engine could not be reached.");
    } finally {
      if (id === seq.current) setBusy(false);
    }
  }, []);

  // Re-solve as the inputs settle. A solve is milliseconds, so this feels live.
  useEffect(() => {
    const t = setTimeout(() => run(inp), 320);
    return () => clearTimeout(t);
  }, [inp, run]);

  const stats = useMemo(() => {
    if (!res) return [];
    return [
      { k: "Crush depth", v: `${fmt(res.crush_mm, 2)} mm`, s: `${fmt(res.crush_strain * 100)}% of pad thickness` },
      { k: "Contact time", v: `${fmt(res.contact_ms, 2)} ms`, s: "loading to full rebound" },
      { k: "Impact speed", v: `${fmt(res.impact_velocity_ms, 2)} m/s`, s: `${fmt(res.impact_energy_j, 1)} J of kinetic energy` },
      { k: "Rebound speed", v: `${fmt(res.rebound_velocity_ms, 2)} m/s`, s: "what the pad gives back" },
      { k: "Lock-up strain", v: fmt(res.densification_strain, 3), s: "Gibson-Ashby, nothing fitted to it" },
      { k: "Plateau stress", v: `${fmt(res.plateau_stress_kpa)} kPa`, s: "the flat crushing region" },
      { k: "Relative density", v: fmt(res.relative_density, 3), s: "foam over solid polymer" },
      { k: "Pad softening", v: `${fmt(res.damage_fraction * 100)}%`, s: "Mullins damage from prior hits" },
    ];
  }, [res]);

  return (
    <div className="imp">
      <header className="imp__head">
        <div>
          <p className="imp__eyebrow">Impact engine</p>
          <h1>Drop something on a foam pad and see the whole pulse.</h1>
          <p className="imp__sub">
            Gibson-Ashby cellular scaling, a three-stage crush law, damage from prior hits and rate
            hardening. Nine constants, fitted once against real drop-tower data and then held fixed.
            Change any input and it re-solves.
          </p>
        </div>
        <div className="imp__val">
          <span className="imp__vlbl">Held-out error on peak G</span>
          <div className="imp__vrow"><b>26.9%</b><span>ALPHA, predicting a foam grade it never saw</span></div>
          <div className="imp__vrow imp__vrow--dim"><b>56.1%</b><span>the standard desk method, same twelve impacts</span></div>
        </div>
      </header>

      <div className="imp__grid2">
        {/* ── controls ── */}
        <aside className="imp__panel">
          <h2 className="imp__ptitle">The pad</h2>

          <div className="imp__grades">
            {GRADES.map((g) => (
              <button key={g.name} type="button"
                className={inp.density === g.density ? "imp__grade is-on" : "imp__grade"}
                onClick={() => set("density", g.density)}>
                <b>{g.name}</b><span>{g.density} kg/m&sup3;</span><i>{g.note}</i>
              </button>
            ))}
          </div>

          <Field label="Foam density" unit="kg/m³" value={inp.density} min={20} max={400} step={0.5}
            onChange={(v) => set("density", v)}
            hint="Tested from 97.5 to 183. Outside that the model is extrapolating and says so." />
          <Field label="Pad thickness" unit="mm" value={inp.thickness} min={5} max={120} step={0.1}
            onChange={(v) => set("thickness", v)} hint="Every tested pad was 25.4 mm." />
          <Field label="Pad diameter" unit="mm" value={inp.diameter} min={20} max={200} step={0.1}
            onChange={(v) => set("diameter", v)} hint="Flat impactor, so contact area stays constant." />

          <h2 className="imp__ptitle">The impact</h2>

          <div className="imp__toggle" role="group" aria-label="How the impact is specified">
            <button type="button" className={inp.drive === "height" ? "is-on" : ""}
              onClick={() => set("drive", "height")}>Drop height</button>
            <button type="button" className={inp.drive === "velocity" ? "is-on" : ""}
              onClick={() => set("drive", "velocity")}>Measured speed</button>
          </div>

          {inp.drive === "height" ? (
            <Field label="Drop height" unit="m" value={inp.height} min={0.02} max={3} step={0.01}
              onChange={(v) => set("height", v)}
              hint="Converted with v = sqrt(2gh), which ignores rig friction. A lab should send its own gate speed instead." />
          ) : (
            <Field label="Impact speed" unit="m/s" value={inp.velocity} min={0.5} max={12} step={0.01}
              onChange={(v) => set("velocity", v)} hint="Tested from 2.38 to 4.28 m/s." />
          )}

          <Field label="Impactor mass" unit="kg" value={inp.mass} min={0.5} max={50} step={0.1}
            onChange={(v) => set("mass", v)} hint="The lab rig dropped 5 kg." />
          <Field label="Prior strain" unit="" value={inp.prior} min={0} max={0.9} step={0.01}
            onChange={(v) => set("prior", v)}
            hint="0 is a fresh pad. Foam that has already been crushed comes back softer, and the model accounts for it." />
        </aside>

        {/* ── results ── */}
        <div className="imp__out">
          {err && (
            <div className="imp__err">
              <b>The engine declined this pad.</b>
              <p>{err}</p>
            </div>
          )}

          {!res && !err && (
            <div className="imp__wait">
              <span className="imp__spin" aria-hidden="true" />
              <p>Waking the engine. The free tier sleeps when idle, so the first solve can take a minute.</p>
            </div>
          )}

          {res && (
            <>
              <div className={busy ? "imp__result is-busy" : "imp__result"}>
                <div className="imp__peak">
                  <span className="imp__plbl">Peak deceleration</span>
                  <b>{fmt(res.peak_g)}<i>G</i></b>
                  <span className="imp__prange">
                    {fmt(res.peak_low_g)} to {fmt(res.peak_high_g)} G, from the held-out error
                  </span>
                </div>
                <div className="imp__flags">
                  <span className={`imp__flag imp__flag--${res.domain === "in_domain" ? "ok" : "warn"}`}>
                    {res.domain === "in_domain" ? "Inside the tested envelope" : "Extrapolating"}
                  </span>
                  {res.bottomed_out && <span className="imp__flag imp__flag--bad">Bottomed out</span>}
                  <span className="imp__flag imp__flag--plain">Screening only</span>
                </div>
              </div>

              {res.outside_tested_envelope.length > 0 && (
                <div className="imp__warn">
                  <b>Outside what the lab actually tested</b>
                  <ul>{res.outside_tested_envelope.map((r) => <li key={r}>{r}</li>)}</ul>
                  <p>The physics still applies. The error bar above was measured inside the envelope, so treat it as a floor rather than a promise.</p>
                </div>
              )}

              {res.bottomed_out && (
                <div className="imp__warn imp__warn--bad">
                  <b>The pad ran out of travel</b>
                  <p>
                    Crush reached the densification strain, which means the cell walls closed and the
                    impactor started compressing solid polymer. This is where a real pad stops
                    protecting and the deceleration spikes. Add thickness or drop density.
                  </p>
                </div>
              )}

              <Pulse res={res} />

              <div className="imp__stats">
                {stats.map((s) => (
                  <div key={s.k}>
                    <span className="imp__slbl">{s.k}</span>
                    <b>{s.v}</b>
                    <span className="imp__snote">{s.s}</span>
                  </div>
                ))}
              </div>

              <p className="imp__foot">{res.note}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── one labelled slider with a typed value next to it ─────────────────── */

function Field({ label, unit, value, min, max, step, onChange, hint }: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; hint: string;
}) {
  return (
    <label className="imp__field">
      <span className="imp__flbl">
        {label}
        <input className="imp__num" type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }} />
        {unit && <i>{unit}</i>}
      </span>
      <input className="imp__range" type="range" value={value} min={min} max={max} step={step}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span className="imp__hint">{hint}</span>
    </label>
  );
}
