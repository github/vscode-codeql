import { faker } from "@faker-js/faker";
import {
  DbConfig,
  LocalDatabase,
  LocalList,
  RemoteRepositoryList,
  SelectedDbItem,
  DB_CONFIG_VERSION,
} from "../../src/databases/config/db-config";
import { DatabaseOrigin } from "../../src/databases/local-databases/database-origin";

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
    version: DB_CONFIG_VERSION,
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
  name = `database${faker.number.int()}`,
  dateAdded = faker.date.past().getTime(),
  language = `language${faker.number.int()}`,
  storagePath = `storagePath${faker.number.int()}`,
  origin = {
    type: "folder",
  },
}: {
  name?: string;
  dateAdded?: number;
  language?: string;
  storagePath?: string;
  origin?: DatabaseOrigin;
} = {}): LocalDatabase {
  return {
    name,
    dateAdded,
    language,
    storagePath,
    origin,
  };
}
