import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";

export function calculateModelledPercentage(
  externalApiUsages: Array<Pick<ExternalApiUsage, "supported">>,
): number {
  if (externalApiUsages.length === 0) {
    return 0;
  }

  const modelledExternalApiUsages = externalApiUsages.filter(
    (m) => m.supported,
  );

  const modelledRatio =
    modelledExternalApiUsages.length / externalApiUsages.length;
  return modelledRatio * 100;
}
