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
  shear_conformal90_gpa?: number;
  bulk_conformal90_gpa?: number;
  band_gap_conformal90_ev?: number;
  domain?: "in_domain" | "extrapolating" | "out_of_scope";
  scope_note?: string;
  reduced_formula?: string;
  neighbors?: { formula: string; shear_modulus_gpa: number }[];
  density_est_gcc?: number;
  sound_speed_shear_ms?: number;
  sound_speed_long_ms?: number;
  acoustic_impedance_mrayl?: number;
  specific_stiffness_gpa_gcc?: number;
  kmin_clarke_w_mk?: number;
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

/* ── impact engine ─────────────────────────────────────────────────────── */

export type ImpactRequest = {
  density_kg_m3: number;
  thickness_mm: number;
  diameter_mm: number;
  impactor_mass_kg: number;
  drop_height_m?: number | null;
  impact_velocity_ms?: number | null;
  prior_strain: number;
};

export type ImpactResult = {
  peak_g: number;
  peak_low_g: number;
  peak_high_g: number;
  peak_uncertainty_pct: number;
  crush_mm: number;
  crush_strain: number;
  densification_strain: number;
  bottomed_out: boolean;
  contact_ms: number;
  impact_velocity_ms: number;
  impact_energy_j: number;
  rebound_velocity_ms: number;
  contact_area_cm2: number;
  relative_density: number;
  plateau_stress_kpa: number;
  damage_fraction: number;
  domain: "in_domain" | "extrapolating";
  outside_tested_envelope: string[];
  curve: { t_ms: number[]; accel_g: number[]; crush_mm: number[] };
  evidence_status: string;
  note: string;
};

export async function simulateImpact(req: ImpactRequest): Promise<ImpactResult> {
  const res = await fetch(`${API_BASE}/v1/impact/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        "The impact engine is not on this API build yet. It ships with the next deploy of alpha-core.",
      );
    }
    // The engine refuses impossible pads on purpose; show its reason, not a code.
    const detail = data?.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && detail[0]?.msg
          ? String(detail[0].msg).replace(/^Value error, /, "")
          : `Engine responded ${res.status}`;
    throw new Error(msg);
  }
  return data as ImpactResult;
}
