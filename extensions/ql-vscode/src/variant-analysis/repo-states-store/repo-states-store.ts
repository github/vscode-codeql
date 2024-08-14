import { outputJson, readJson } from "fs-extra";
import type { VariantAnalysisScannedRepositoryState } from "../shared/variant-analysis";
import type { VariantAnalysisScannedRepositoryStateDto } from "./repo-states-dto";
import { mapRepoStatesToDto } from "./repo-states-dto-mapper";
import { mapRepoStatesToDomainModel } from "./repo-states-domain-mapper";

export const REPO_STATES_FILENAME = "repo_states.json";

export async function writeRepoStates(
  storagePath: string,
  repoStates: Record<number, VariantAnalysisScannedRepositoryState>,
): Promise<void> {
  const repoStatesData = mapRepoStatesToDto(repoStates);
  await outputJson(storagePath, repoStatesData);
}

export async function readRepoStates(
  storagePath: string,
): Promise<Record<number, VariantAnalysisScannedRepositoryState> | undefined> {
  try {
    const repoStatesData: Record<
      number,
      VariantAnalysisScannedRepositoryStateDto
    > = await readJson(storagePath);

    const repoStates = mapRepoStatesToDomainModel(repoStatesData);

    return repoStates;
  } catch {
    // Ignore this error, we simply might not have downloaded anything yet
    return undefined;
  }
}
