import { outputJson, readJson } from "fs-extra";
import { VariantAnalysisScannedRepositoryState } from "../shared/variant-analysis";
import { VariantAnalysisScannedRepositoryStateData } from "./repo-states-data-types";

export const REPO_STATES_FILENAME = "repo_states.json";

export async function writeRepoStates(
  storagePath: string,
  repoStates: Record<number, VariantAnalysisScannedRepositoryState>,
): Promise<void> {
  // Map from repoStates Domain type to the repoStates Data type
  const repoStatesData = Object.fromEntries(
    Object.entries(repoStates).map(([key, value]) => {
      const dataItem: VariantAnalysisScannedRepositoryStateData = value;
      return [key, dataItem];
    }),
  );

  return await outputJson(storagePath, repoStatesData);
}

export async function readRepoStates(
  storagePath: string,
): Promise<Record<number, VariantAnalysisScannedRepositoryState>> {
  const repoStatesData: Record<
    number,
    VariantAnalysisScannedRepositoryStateData
  > = await readJson(storagePath);

  // Map from repoStates Data type to the repoStates Domain type
  const repoStates = Object.fromEntries(
    Object.entries(repoStatesData).map(([key, value]) => {
      const dataItem: VariantAnalysisScannedRepositoryState = value;
      return [key, dataItem];
    }),
  );

  return repoStates;
}
