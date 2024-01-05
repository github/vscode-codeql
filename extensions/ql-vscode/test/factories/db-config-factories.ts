import type {
  DbConfig,
  RemoteRepositoryList,
  SelectedDbItem,
} from "../../src/databases/config/db-config";
import { DB_CONFIG_VERSION } from "../../src/databases/config/db-config";

export function createDbConfig({
  remoteLists = [],
  remoteOwners = [],
  remoteRepos = [],
  selected = undefined,
}: {
  remoteLists?: RemoteRepositoryList[];
  remoteOwners?: string[];
  remoteRepos?: string[];
  selected?: SelectedDbItem;
} = {}): DbConfig {
  return {
    version: DB_CONFIG_VERSION,
    databases: {
      variantAnalysis: {
        repositoryLists: remoteLists,
        owners: remoteOwners,
        repositories: remoteRepos,
      },
    },
    selected,
  };
}
