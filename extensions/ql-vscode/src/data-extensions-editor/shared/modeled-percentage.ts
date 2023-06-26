import { ExternalApiUsage } from "../external-api-usage";

export function calculateModeledPercentage(
  externalApiUsages: Array<Pick<ExternalApiUsage, "supported">>,
): number {
  if (externalApiUsages.length === 0) {
    return 0;
  }

  const modeledExternalApiUsages = externalApiUsages.filter((m) => m.supported);

  const modeledRatio =
    modeledExternalApiUsages.length / externalApiUsages.length;
  return modeledRatio * 100;
}
