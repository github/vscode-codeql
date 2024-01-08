import type { RemoteRepositoryList } from "../../../../src/databases/config/db-config";
import {
  removeRemoteList,
  removeRemoteOwner,
  removeRemoteRepo,
  renameRemoteList,
  SelectedDbItemKind,
} from "../../../../src/databases/config/db-config";
import { createDbConfig } from "../../../factories/db-config-factories";

describe("db config", () => {
  describe("renameRemoteList", () => {
    it("should rename a remote list", () => {
      const originalConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: [],
          },
          {
            name: "list2",
            repositories: [],
          },
        ],
      });

      const updatedConfig = renameRemoteList(
        originalConfig,
        "list1",
        "listRenamed",
      );

      expect(updatedConfig.databases.variantAnalysis.repositoryLists).toEqual([
        {
          name: "listRenamed",
          repositories: [],
        },
        {
          name: "list2",
          repositories: [],
        },
      ]);
    });

    it("should rename a selected remote list", () => {
      const originalConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: [],
          },
          {
            name: "list2",
            repositories: [],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
          listName: "list1",
        },
      });

      const updatedConfig = renameRemoteList(
        originalConfig,
        "list1",
        "listRenamed",
      );

      expect(updatedConfig.databases.variantAnalysis.repositoryLists).toEqual([
        {
          name: "listRenamed",
          repositories: [],
        },
        {
          name: "list2",
          repositories: [],
        },
      ]);

      expect(updatedConfig.selected).toEqual({
        kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
        listName: "listRenamed",
      });
    });

    it("should rename a remote list with a db that is selected", () => {
      const selectedRemoteRepo = "owner/repo2";
      const originalConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: ["owner1/repo1", selectedRemoteRepo, "owner1/repo3"],
          },
          {
            name: "list2",
            repositories: [],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisRepository,
          repositoryName: selectedRemoteRepo,
          listName: "list1",
        },
      });

      const updatedConfig = renameRemoteList(
        originalConfig,
        "list1",
        "listRenamed",
      );
      const updatedRepositoryLists =
        updatedConfig.databases.variantAnalysis.repositoryLists;

      expect(updatedRepositoryLists.length).toEqual(2);
      expect(updatedRepositoryLists[0]).toEqual({
        ...originalConfig.databases.variantAnalysis.repositoryLists[0],
        name: "listRenamed",
      });
      expect(updatedRepositoryLists[1]).toEqual(
        originalConfig.databases.variantAnalysis.repositoryLists[1],
      );

      expect(updatedConfig.selected).toEqual({
        kind: SelectedDbItemKind.VariantAnalysisRepository,
        repositoryName: selectedRemoteRepo,
        listName: "listRenamed",
      });
    });
  });

  describe("removeRemoteList", () => {
    it("should remove a remote list", () => {
      const originalConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: [],
          },
          {
            name: "list2",
            repositories: [],
          },
        ],
      });

      const updatedConfig = removeRemoteList(originalConfig, "list1");

      expect(updatedConfig.databases.variantAnalysis.repositoryLists).toEqual([
        {
          name: "list2",
          repositories: [],
        },
      ]);
    });

    it("should remove a selected remote list", () => {
      const originalConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: [],
          },
          {
            name: "list2",
            repositories: [],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
          listName: "list1",
        },
      });

      const updatedConfig = removeRemoteList(originalConfig, "list1");

      expect(updatedConfig.databases.variantAnalysis.repositoryLists).toEqual([
        {
          name: "list2",
          repositories: [],
        },
      ]);

      expect(updatedConfig.selected).toBeUndefined();
    });

    it("should remove a remote list with a db that is selected", () => {
      const selectedRemoteRepo = "owner/repo2";
      const originalConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: ["owner1/repo1", selectedRemoteRepo, "owner1/repo3"],
          },
          {
            name: "list2",
            repositories: [],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisRepository,
          repositoryName: selectedRemoteRepo,
          listName: "list1",
        },
      });

      const updatedConfig = removeRemoteList(originalConfig, "list1");
      const updatedRepositoryLists =
        updatedConfig.databases.variantAnalysis.repositoryLists;

      expect(updatedRepositoryLists.length).toEqual(1);
      expect(updatedRepositoryLists[0]).toEqual(
        originalConfig.databases.variantAnalysis.repositoryLists[1],
      );
      expect(updatedConfig.selected).toBeUndefined();
    });
  });

  describe("removeRemoteRepo", () => {
    it("should remove a remote repo", () => {
      const repo1 = "owner1/repo1";
      const repo2 = "owner1/repo2";

      const originalConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: [repo1, repo2],
          },
        ],
        remoteRepos: [repo1, repo2],
      });

      const updatedConfig = removeRemoteRepo(originalConfig, repo1);

      const updatedRemoteDbs = updatedConfig.databases.variantAnalysis;
      const originalRemoteDbs = originalConfig.databases.variantAnalysis;
      expect(updatedRemoteDbs.repositories.length).toEqual(1);
      expect(updatedRemoteDbs.repositories[0]).toEqual(repo2);
      expect(updatedRemoteDbs.repositoryLists).toEqual(
        originalRemoteDbs.repositoryLists,
      );
    });

    it("should remove a remote repo inside a list", () => {
      const repo1 = "owner1/repo1";
      const repo2 = "owner1/repo2";

      const list1: RemoteRepositoryList = {
        name: "list1",
        repositories: [repo1, repo2],
      };
      const list2: RemoteRepositoryList = {
        name: "list2",
        repositories: [repo1, repo2],
      };

      const originalConfig = createDbConfig({
        remoteLists: [list1, list2],
        remoteRepos: [repo1, repo2],
      });

      const updatedConfig = removeRemoteRepo(originalConfig, repo1, list1.name);
      const updatedRemoteDbs = updatedConfig.databases.variantAnalysis;
      const originalRemoteDbs = originalConfig.databases.variantAnalysis;
      expect(updatedRemoteDbs.repositories).toEqual(
        originalRemoteDbs.repositories,
      );
      expect(updatedRemoteDbs.repositoryLists.length).toEqual(2);
      expect(updatedRemoteDbs.repositoryLists[0].repositories.length).toEqual(
        1,
      );
      expect(updatedRemoteDbs.repositoryLists[0].repositories[0]).toEqual(
        repo2,
      );
      expect(updatedRemoteDbs.repositoryLists[1]).toEqual(
        originalRemoteDbs.repositoryLists[1],
      );
    });

    it("should remove a remote repo that is selected", () => {
      const repo1 = "owner1/repo1";
      const repo2 = "owner1/repo2";

      const originalConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: [repo1, repo2],
          },
        ],
        remoteRepos: [repo1, repo2],
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisRepository,
          repositoryName: repo1,
        },
      });

      const updatedConfig = removeRemoteRepo(originalConfig, repo1);

      const updatedRemoteDbs = updatedConfig.databases.variantAnalysis;
      const originalRemoteDbs = originalConfig.databases.variantAnalysis;
      expect(updatedRemoteDbs.repositories.length).toEqual(1);
      expect(updatedRemoteDbs.repositories[0]).toEqual(repo2);
      expect(updatedRemoteDbs.repositoryLists).toEqual(
        originalRemoteDbs.repositoryLists,
      );
      expect(updatedConfig.selected).toBeUndefined();
    });
  });

  describe("removeOwner", () => {
    it("should remove a remote owner", () => {
      const owner1 = "owner1";
      const owner2 = "owner2";

      const originalConfig = createDbConfig({
        remoteOwners: [owner1, owner2],
      });

      const updatedConfig = removeRemoteOwner(originalConfig, owner1);

      const updatedRemoteDbs = updatedConfig.databases.variantAnalysis;
      expect(updatedRemoteDbs.owners).toEqual([owner2]);
    });

    it("should remove a remote owner that is selected", () => {
      const owner1 = "owner1";
      const owner2 = "owner2";

      const originalConfig = createDbConfig({
        remoteOwners: [owner1, owner2],
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisOwner,
          ownerName: owner1,
        },
      });

      const updatedConfig = removeRemoteOwner(originalConfig, owner1);

      const updatedRemoteDbs = updatedConfig.databases.variantAnalysis;
      expect(updatedRemoteDbs.owners).toEqual([owner2]);
      expect(updatedConfig.selected).toBeUndefined();
    });
  });
});
