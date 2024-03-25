import type { AnalysisAlert } from "../../variant-analysis/shared/analysis-result";
import type { ModeledMethod } from "../modeled-method";

export interface ModelAlerts {
  model: ModeledMethod;
  alerts: Array<{
    alert: AnalysisAlert;
    repository: {
      id: number;
      fullName: string;
    };
  }>;
}
