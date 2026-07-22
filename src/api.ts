// The live inference API (alpha-core). Override with ?api=https://... for demos.
const override = new URLSearchParams(window.location.search).get("api");

export const API_BASE = (
  override ??
  (import.meta.env.DEV
    ? "http://localhost:8000"
    : "https://alpha-core-api.onrender.com")
).replace(/\/+$/, "");

export type Prediction = {
  rank: number;
  formula: string;
  shear_modulus_gpa: number | null;
  uncertainty_gpa?: number;
  low_gpa?: number;
  high_gpa?: number;
  bulk_modulus_gpa?: number;
  bulk_uncertainty_gpa?: number;
  youngs_modulus_gpa?: number;
  poisson_ratio?: number;
  vickers_hardness_gpa?: number;
  pugh_ratio?: number;
  character?: "less brittle" | "more brittle";
  band_gap_ev?: number;
  band_gap_uncertainty_ev?: number;
  electronic_class?: "metallic" | "semiconductor" | "insulator";
  evidence_status?: string;
  note?: string;
};

export async function predict(formulas: string[]): Promise<Prediction[]> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formulas }),
  });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  const data = await res.json();
  return data.results as Prediction[];
}

export type ModelHead = {
  target: string;
  unit: string;
  r2: number;
  mae: number;
  n_train: number;
  n_test: number;
};

export type ModelCard = {
  target: string;
  unit: string;
  r2: number;
  mae_gpa: number;
  n_train: number;
  n_test: number;
  evidence_status: string;
  heads?: ModelHead[];
  derived?: string[];
};

export async function fetchModelCard(): Promise<ModelCard | null> {
  try {
    const res = await fetch(`${API_BASE}/model`);
    return res.ok ? ((await res.json()) as ModelCard) : null;
  } catch {
    return null;
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
