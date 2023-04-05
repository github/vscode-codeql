import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";

export function calculateSupportedPercentage(
  externalApiUsages: Array<Pick<ExternalApiUsage, "supported">>,
): number {
  if (externalApiUsages.length === 0) {
    return 0;
  }

  const supportedExternalApiUsages = externalApiUsages.filter(
    (m) => m.supported,
  );

  const supportedRatio =
    supportedExternalApiUsages.length / externalApiUsages.length;
  return supportedRatio * 100;
}
