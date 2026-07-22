import { useState } from "react";
import { BENCHMARK, SERIES } from "./benchmark";

/* Benchmark line chart: MAE (GPa) vs training-set size, log x.
   Hand-rolled SVG so the page ships with zero chart dependencies. */

const W = 780;
const H = 380;
const M = { t: 26, r: 34, b: 50, l: 58 };

const NS = BENCHMARK.map((r) => r.n_train);
const LX0 = Math.log(NS[0]);
const LX1 = Math.log(NS[NS.length - 1]);
const Y0 = 10;
const Y1 = 28;

const xOf = (n: number) =>
  M.l + ((Math.log(n) - LX0) / (LX1 - LX0)) * (W - M.l - M.r);
const yOf = (v: number) =>
  H - M.b - ((v - Y0) / (Y1 - Y0)) * (H - M.t - M.b);

const Y_TICKS = [12, 16, 20, 24, 28];

export default function Chart() {
  const [hover, setHover] = useState<number | null>(null);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * (W - M.l - M.r) + M.l;
    let best = 0;
    let bestD = Infinity;
    NS.forEach((n, i) => {
      const d = Math.abs(xOf(n) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const row = hover === null ? null : BENCHMARK[hover];
  const delta =
    row === null
      ? 0
      : Math.round(((row.data_net_mae - row.physics_net_mae) / row.data_net_mae) * 100);

  return (
    <div className="chart">
      <div className="chart__legend" role="list">
        {SERIES.map((s) => (
          <span className="chart__key" role="listitem" key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="chart__stage">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="chart__svg"
          role="img"
          aria-label="Mean absolute error versus training-set size for three models. The physics-informed net has the lowest error when training data is scarce."
        >
          {/* scarce-data regime */}
          <rect
            x={xOf(20)}
            y={M.t}
            width={xOf(80) - xOf(20)}
            height={H - M.t - M.b}
            className="chart__zone"
          />
          <text x={xOf(20) + 10} y={H - M.b - 26} className="chart__zoneLabel">
            SCARCE-DATA REGIME
          </text>
          <text x={xOf(20) + 10} y={H - M.b - 11} className="chart__zoneSub">
            real impact tests: 20–80 coupons
          </text>

          {/* grid + axes */}
          {Y_TICKS.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={yOf(t)} y2={yOf(t)} className="chart__grid" />
              <text x={M.l - 10} y={yOf(t) + 4} className="chart__tick" textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {NS.map((n) => (
            <text key={n} x={xOf(n)} y={H - M.b + 22} className="chart__tick" textAnchor="middle">
              {n}
            </text>
          ))}
          <text x={M.l} y={12} className="chart__axis">
            MAE · GPa
          </text>
          <text x={W - M.r} y={H - 8} className="chart__axis" textAnchor="end">
            training samples (log)
          </text>

          {/* crosshair */}
          {row && (
            <line
              x1={xOf(row.n_train)}
              x2={xOf(row.n_train)}
              y1={M.t}
              y2={H - M.b}
              className="chart__cross"
            />
          )}

          {/* series */}
          {SERIES.map((s) => {
            const d = BENCHMARK.map(
              (r, i) => `${i === 0 ? "M" : "L"}${xOf(r.n_train)},${yOf(r[s.key])}`,
            ).join(" ");
            return (
              <g key={s.key}>
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} />
                {BENCHMARK.map((r) => (
                  <circle
                    key={r.n_train}
                    cx={xOf(r.n_train)}
                    cy={yOf(r[s.key])}
                    r={hover !== null && NS[hover] === r.n_train ? 5 : 3.5}
                    fill={s.color}
                    className="chart__pt"
                  />
                ))}
              </g>
            );
          })}

          {/* direct labels at the scarce end, where the lines separate */}
          {SERIES.map((s) => (
            <g key={`lb-${s.key}`}>
              <circle cx={xOf(22)} cy={yOf(BENCHMARK[0][s.key]) - 12} r={3.5} fill={s.color} />
              <text x={xOf(22) + 9} y={yOf(BENCHMARK[0][s.key]) - 8} className="chart__dlabel">
                {s.label}
              </text>
            </g>
          ))}

          <rect
            x={M.l}
            y={M.t}
            width={W - M.l - M.r}
            height={H - M.t - M.b}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>

        {row && (
          <div
            className="chart__tip"
            style={{
              left: `${(xOf(row.n_train) / W) * 100}%`,
              transform:
                xOf(row.n_train) > W * 0.62 ? "translate(-104%, 0)" : "translate(14px, 0)",
            }}
          >
            <b>{row.n_train} training samples</b>
            {[...SERIES]
              .sort((a, b) => row[a.key] - row[b.key])
              .map((s) => (
                <span key={s.key} className="chart__tipRow">
                  <i style={{ background: s.color }} />
                  {s.label}
                  <em>{row[s.key].toFixed(1)}</em>
                </span>
              ))}
            {delta > 0 && (
              <span className="chart__tipDelta">physics cuts error {delta}% vs data-only</span>
            )}
          </div>
        )}
      </div>

      <details className="chart__table">
        <summary>View as table</summary>
        <table>
          <thead>
            <tr>
              <th>Training samples</th>
              {SERIES.map((s) => (
                <th key={s.key}>{s.label} · MAE GPa</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BENCHMARK.map((r) => (
              <tr key={r.n_train}>
                <td>{r.n_train}</td>
                {SERIES.map((s) => (
                  <td key={s.key}>{r[s.key].toFixed(2)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
