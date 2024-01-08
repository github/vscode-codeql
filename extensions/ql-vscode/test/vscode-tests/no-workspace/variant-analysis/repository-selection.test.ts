import { getRepositorySelection } from "../../../../src/variant-analysis/repository-selection";
import type { DbManager } from "../../../../src/databases/db-manager";
import type {
  DbItem,
  RemoteRepoDbItem,
} from "../../../../src/databases/db-item";
import { DbItemKind } from "../../../../src/databases/db-item";

describe("repository selection", () => {
  it("should throw error when no database item is selected", async () => {
    const dbManager = setUpDbManager(undefined);

    await expect(getRepositorySelection(dbManager)).rejects.toThrow(
      "Please select a remote database to run the query against.",
    );
  });

  it("should log an error when an empty remote user defined list is selected", async () => {
    const dbManager = setUpDbManager({
      kind: DbItemKind.RemoteUserDefinedList,
      repos: [] as RemoteRepoDbItem[],
    } as DbItem);

    await expect(getRepositorySelection(dbManager)).rejects.toThrow(
      "The selected repository list is empty. Please add repositories to it before running a variant analysis.",
    );
  });

  it("should return correct selection when remote system defined list is selected", async () => {
    const dbManager = setUpDbManager({
      kind: DbItemKind.RemoteSystemDefinedList,
      listName: "top_10",
    } as DbItem);

    const repoSelection = await getRepositorySelection(dbManager);

    expect(repoSelection.repositoryLists).toEqual(["top_10"]);
    expect(repoSelection.owners).toBeUndefined();
    expect(repoSelection.repositories).toBeUndefined();
  });

  it("should return correct selection when remote user defined list is selected", async () => {
    const dbManager = setUpDbManager({
      kind: DbItemKind.RemoteUserDefinedList,
      repos: [
        { repoFullName: "owner1/repo1" },
        { repoFullName: "owner1/repo2" },
      ],
    } as DbItem);

    const repoSelection = await getRepositorySelection(dbManager);

    expect(repoSelection.repositoryLists).toBeUndefined();
    expect(repoSelection.owners).toBeUndefined();
    expect(repoSelection.repositories).toEqual([
      "owner1/repo1",
      "owner1/repo2",
    ]);
  });

  it("should return correct selection when remote owner is selected", async () => {
    const dbManager = setUpDbManager({
      kind: DbItemKind.RemoteOwner,
      ownerName: "owner2",
    } as DbItem);

    const repoSelection = await getRepositorySelection(dbManager);

    expect(repoSelection.repositoryLists).toBeUndefined();
    expect(repoSelection.owners).toEqual(["owner2"]);
    expect(repoSelection.repositories).toBeUndefined();
  });

  it("should return correct selection when remote repo is selected", async () => {
    const dbManager = setUpDbManager({
      kind: DbItemKind.RemoteRepo,
      repoFullName: "owner1/repo2",
    } as DbItem);

    const repoSelection = await getRepositorySelection(dbManager);

    expect(repoSelection.repositoryLists).toBeUndefined();
    expect(repoSelection.owners).toBeUndefined();
    expect(repoSelection.repositories).toEqual(["owner1/repo2"]);
  });

  function setUpDbManager(response: DbItem | undefined): DbManager {
    return {
      getSelectedDbItem: jest.fn(() => {
        return response;
      }),
    } as any as DbManager;
  }
});
