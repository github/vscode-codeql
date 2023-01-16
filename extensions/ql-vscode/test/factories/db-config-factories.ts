import { faker } from "@faker-js/faker";
import {
  DbConfig,
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
}: {
  remoteLists?: RemoteRepositoryList[];
  remoteOwners?: string[];
  remoteRepos?: string[];
  localLists?: LocalList[];
  localDbs?: LocalDatabase[];
  selected?: SelectedDbItem;
} = {}): DbConfig {
  return {
    databases: {
      variantAnalysis: {
        repositoryLists: remoteLists,
        owners: remoteOwners,
        repositories: remoteRepos,
      },
      local: {
        lists: localLists,
        databases: localDbs,
      },
    },
    selected,
  };
}

export function createLocalDbConfigItem({
  name = `database${faker.datatype.number()}`,
  dateAdded = faker.date.past().getTime(),
  language = `language${faker.datatype.number()}`,
  storagePath = `storagePath${faker.datatype.number()}`,
}: {
  name?: string;
  dateAdded?: number;
  language?: string;
  storagePath?: string;
} = {}): LocalDatabase {
  return {
    name,
    dateAdded,
    language,
    storagePath,
  };
}
