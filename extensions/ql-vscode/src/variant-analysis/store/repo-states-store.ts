import { outputJson, readJson } from "fs-extra";
import { VariantAnalysisScannedRepositoryState } from "../shared/variant-analysis";

export const REPO_STATES_FILENAME = "repo_states.json";

export async function writeRepoStates(
  storagePath: string,
  repoStates: Record<number, VariantAnalysisScannedRepositoryState> | undefined,
): Promise<void> {
  return await outputJson(storagePath, repoStates);
}

export async function readRepoStates(
  storagePath: string,
): Promise<Record<number, VariantAnalysisScannedRepositoryState>> {
  return await readJson(storagePath);
}
