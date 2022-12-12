import {
  DbConfig,
  ExpandedDbItem,
  LocalDatabase,
  LocalList,
  RemoteRepositoryList,
  SelectedDbItem,
} from "../../src/databases/config/db-config";

export function createDbConfig({
  remoteLists = [],
  remoteOwners = [],
  remoteRepos = [],
  localLists = [],
  localDbs = [],
  selected = undefined,
  expanded = [],
}: {
  remoteLists?: RemoteRepositoryList[];
  remoteOwners?: string[];
  remoteRepos?: string[];
  localLists?: LocalList[];
  localDbs?: LocalDatabase[];
  selected?: SelectedDbItem;
  expanded?: ExpandedDbItem[];
} = {}): DbConfig {
  return {
    databases: {
      remote: {
        repositoryLists: remoteLists,
        owners: remoteOwners,
        repositories: remoteRepos,
      },
      local: {
        lists: localLists,
        databases: localDbs,
      },
    },
    expanded,
    selected,
  };
}
