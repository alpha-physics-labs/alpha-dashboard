# ALPHA Dashboard

Material Intelligence Console — type any chemical formula, get a physics-informed
property prediction with honest uncertainty.

Live: https://alpha-physics-labs.github.io/alpha-dashboard/

## What it shows

- **Predict** — any formula → 132 physics descriptors → shear-modulus prediction
  with a test-set uncertainty band. Powered by the alpha-core inference API.
- **Evidence** — a measured benchmark: physics-informed learning vs data-only
  learning vs XGBoost across training-set sizes. Physics wins where data is scarce.
- **Markets** — one engine, a property head per market.
- **Model card** — what the model is validated on, and what it is not.

All predictions are screening grade (`SCREENING_ONLY`): decision support for which
materials to test first, not certified design values.

## Run locally

```bash
npm install
npm run dev
```

The dashboard talks to the alpha-core API — `http://localhost:8000` in dev, the
hosted API in production. Point it anywhere with `?api=https://your-host`.

## Stack

Vite · React · TypeScript. The chart is hand-rolled SVG — no chart dependencies.
