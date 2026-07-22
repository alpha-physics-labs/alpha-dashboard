// Measured results from alpha-core models/physics_benchmark.json.
// MAE in GPa on 1,950 held-out materials; each point averages 3 random seeds.

export type BenchmarkRow = {
  n_train: number;
  data_net_mae: number;
  physics_net_mae: number;
  xgboost_mae: number;
};

export const BENCHMARK: BenchmarkRow[] = [
  { n_train: 20, data_net_mae: 26.97, physics_net_mae: 21.29, xgboost_mae: 24.38 },
  { n_train: 40, data_net_mae: 24.23, physics_net_mae: 18.04, xgboost_mae: 20.96 },
  { n_train: 80, data_net_mae: 19.63, physics_net_mae: 17.12, xgboost_mae: 18.39 },
  { n_train: 160, data_net_mae: 16.91, physics_net_mae: 16.47, xgboost_mae: 15.89 },
  { n_train: 320, data_net_mae: 15.63, physics_net_mae: 15.13, xgboost_mae: 13.94 },
  { n_train: 1000, data_net_mae: 13.29, physics_net_mae: 13.33, xgboost_mae: 11.55 },
];

export const PHYSICS_LAW =
  "log G = c₀ + a₁·log VED + a₂·log COH − b₁·ionicity − a₃·log r_cov";

export const SERIES = [
  { key: "data_net_mae", label: "Data-only neural net", color: "#BE7F1C" },
  { key: "xgboost_mae", label: "XGBoost", color: "#2E9F7E" },
  { key: "physics_net_mae", label: "Physics-informed net", color: "#4E90F2" },
] as const;
