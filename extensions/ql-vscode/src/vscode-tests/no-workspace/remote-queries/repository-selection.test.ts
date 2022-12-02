import { QuickPickItem, window } from "vscode";
import { UserCancellationException } from "../../../commandRunner";

import * as config from "../../../config";
import { getRepositorySelection } from "../../../remote-queries/repository-selection";
import { join } from "path";
import { DirectoryResult } from "tmp-promise";
import * as tmp from "tmp-promise";
import { ensureDir, writeFile, writeJson } from "fs-extra";

describe("repository selection", () => {
  let quickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let showInputBoxSpy: jest.SpiedFunction<typeof window.showInputBox>;

  let getRemoteRepositoryListsSpy: jest.SpiedFunction<
    typeof config.getRemoteRepositoryLists
  >;
  let getRemoteRepositoryListsPathSpy: jest.SpiedFunction<
    typeof config.getRemoteRepositoryListsPath
  >;

  beforeEach(() => {
    quickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockResolvedValue(undefined);
    showInputBoxSpy = jest
      .spyOn(window, "showInputBox")
      .mockResolvedValue(undefined);

    getRemoteRepositoryListsSpy = jest
      .spyOn(config, "getRemoteRepositoryLists")
      .mockReturnValue(undefined);
    getRemoteRepositoryListsPathSpy = jest
      .spyOn(config, "getRemoteRepositoryListsPath")
      .mockReturnValue(undefined);
  });

  describe("repo lists from settings", () => {
    it("should allow selection from repo lists from your pre-defined config", async () => {
      // Fake return values
      quickPickSpy.mockResolvedValue({
        repositories: ["foo/bar", "foo/baz"],
      } as unknown as QuickPickItem);
      getRemoteRepositoryListsSpy.mockReturnValue({
        list1: ["foo/bar", "foo/baz"],
        list2: [],
      });

      // Make the function call
      const repoSelection = await getRepositorySelection();

      // Check that the return value is correct
      expect(repoSelection.repositoryLists).toBeUndefined();
      expect(repoSelection.owners).toBeUndefined();
      expect(repoSelection.repositories).toEqual(["foo/bar", "foo/baz"]);
    });
  });

  describe("system level repo lists", () => {
    it("should allow selection from repo lists defined at the system level", async () => {
      // Fake return values
      quickPickSpy.mockResolvedValue({
        repositoryList: "top_100",
      } as unknown as QuickPickItem);
      getRemoteRepositoryListsSpy.mockReturnValue({
        list1: ["foo/bar", "foo/baz"],
        list2: [],
      });

      // Make the function call
      const repoSelection = await getRepositorySelection();

      // Check that the return value is correct
      expect(repoSelection.repositories).toBeUndefined();
      expect(repoSelection.owners).toBeUndefined();
      expect(repoSelection.repositoryLists).toEqual(["top_100"]);
    });
  });

  describe("custom owner", () => {
    // Test the owner regex in various "good" cases
    const goodOwners = [
      "owner",
      "owner-with-hyphens",
      "ownerWithNumbers58",
      "owner_with_underscores",
      "owner.with.periods.",
    ];
    goodOwners.forEach((owner) => {
      it(`should run on a valid owner that you enter in the text box: ${owner}`, async () => {
        // Fake return values
        quickPickSpy.mockResolvedValue({
          useAllReposOfOwner: true,
        } as unknown as QuickPickItem);
        getRemoteRepositoryListsSpy.mockReturnValue({}); // no pre-defined repo lists
        showInputBoxSpy.mockResolvedValue(owner);

        // Make the function call
        const repoSelection = await getRepositorySelection();

        // Check that the return value is correct
        expect(repoSelection.repositories).toBeUndefined();
        expect(repoSelection.repositoryLists).toBeUndefined();
        expect(repoSelection.owners).toEqual([owner]);
      });
    });

    // Test the owner regex in various "bad" cases
    const badOwners = ["invalid&owner", "owner-with-repo/repo"];
    badOwners.forEach((owner) => {
      it(`should show an error message if you enter an invalid owner in the text box: ${owner}`, async () => {
        // Fake return values
        quickPickSpy.mockResolvedValue({
          useAllReposOfOwner: true,
        } as unknown as QuickPickItem);
        getRemoteRepositoryListsSpy.mockReturnValue({}); // no pre-defined repo lists
        showInputBoxSpy.mockResolvedValue(owner);

        // Function call should throw a UserCancellationException
        await expect(getRepositorySelection()).rejects.toThrow(
          `Invalid user or organization: ${owner}`,
        );
      });
    });

    it("should be ok for the user to change their mind", async () => {
      quickPickSpy.mockResolvedValue({
        useAllReposOfOwner: true,
      } as unknown as QuickPickItem);
      getRemoteRepositoryListsSpy.mockReturnValue({});

      // The user pressed escape to cancel the operation
      showInputBoxSpy.mockResolvedValue(undefined);

      await expect(getRepositorySelection()).rejects.toThrow(
        "No repositories selected",
      );
      await expect(getRepositorySelection()).rejects.toThrow(
        UserCancellationException,
      );
    });
  });

  describe("custom repo", () => {
    // Test the repo regex in various "good" cases
    const goodRepos = [
      "owner/repo",
      "owner_with.symbols-/repo.with-symbols_",
      "ownerWithNumbers58/repoWithNumbers37",
    ];
    goodRepos.forEach((repo) => {
      it(`should run on a valid repo that you enter in the text box: ${repo}`, async () => {
        // Fake return values
        quickPickSpy.mockResolvedValue({
          useCustomRepo: true,
        } as unknown as QuickPickItem);
        getRemoteRepositoryListsSpy.mockReturnValue({}); // no pre-defined repo lists
        showInputBoxSpy.mockResolvedValue(repo);

        // Make the function call
        const repoSelection = await getRepositorySelection();

        // Check that the return value is correct
        expect(repoSelection.repositoryLists).toBeUndefined();
        expect(repoSelection.owners).toBeUndefined();
        expect(repoSelection.repositories).toEqual([repo]);
      });
    });

    // Test the repo regex in various "bad" cases
    const badRepos = [
      "invalid*owner/repo",
      "owner/repo+some&invalid&stuff",
      "owner-with-no-repo/",
      "/repo-with-no-owner",
    ];
    badRepos.forEach((repo) => {
      it(`should show an error message if you enter an invalid repo in the text box: ${repo}`, async () => {
        // Fake return values
        quickPickSpy.mockResolvedValue({
          useCustomRepo: true,
        } as unknown as QuickPickItem);
        getRemoteRepositoryListsSpy.mockReturnValue({}); // no pre-defined repo lists
        showInputBoxSpy.mockResolvedValue(repo);

        // Function call should throw a UserCancellationException
        await expect(getRepositorySelection()).rejects.toThrow(
          "Invalid repository format",
        );
        await expect(getRepositorySelection()).rejects.toThrow(
          UserCancellationException,
        );
      });
    });

    it("should be ok for the user to change their mind", async () => {
      quickPickSpy.mockResolvedValue({
        useCustomRepo: true,
      } as unknown as QuickPickItem);
      getRemoteRepositoryListsSpy.mockReturnValue({});

      // The user pressed escape to cancel the operation
      showInputBoxSpy.mockResolvedValue(undefined);

      await expect(getRepositorySelection()).rejects.toThrow(
        "No repositories selected",
      );
      await expect(getRepositorySelection()).rejects.toThrow(
        UserCancellationException,
      );
    });
  });

  describe("external repository lists file", () => {
    let directory: DirectoryResult;

    beforeEach(async () => {
      directory = await tmp.dir({
        unsafeCleanup: true,
      });
    });

    afterEach(async () => {
      await directory.cleanup();
    });

    it("should fail if path does not exist", async () => {
      const nonExistingFile = join(directory.path, "non-existing-file.json");
      getRemoteRepositoryListsPathSpy.mockReturnValue(nonExistingFile);

      await expect(getRepositorySelection()).rejects.toThrow(
        `External repository lists file does not exist at ${nonExistingFile}`,
      );
    });

    it("should fail if path points to directory", async () => {
      const existingDirectory = join(directory.path, "directory");
      await ensureDir(existingDirectory);
      getRemoteRepositoryListsPathSpy.mockReturnValue(existingDirectory);

      await expect(getRepositorySelection()).rejects.toThrow(
        "External repository lists path should not point to a directory",
      );
    });

    it("should fail if file does not have valid JSON", async () => {
      const existingFile = join(directory.path, "repository-lists.json");
      await writeFile(existingFile, "not-json");
      getRemoteRepositoryListsPathSpy.mockReturnValue(existingFile);

      await expect(getRepositorySelection()).rejects.toThrow(
        "Invalid repository lists file. It should contain valid JSON.",
      );
    });

    it("should fail if file contains array", async () => {
      const existingFile = join(directory.path, "repository-lists.json");
      await writeJson(existingFile, []);
      getRemoteRepositoryListsPathSpy.mockReturnValue(existingFile);

      await expect(getRepositorySelection()).rejects.toThrow(
        "Invalid repository lists file. It should be an object mapping names to a list of repositories.",
      );
    });

    it("should fail if file does not contain repo lists in the right format", async () => {
      const existingFile = join(directory.path, "repository-lists.json");
      const repoLists = {
        list1: "owner1/repo1",
      };
      await writeJson(existingFile, repoLists);
      getRemoteRepositoryListsPathSpy.mockReturnValue(existingFile);

      await expect(getRepositorySelection()).rejects.toThrow(
        "Invalid repository lists file. It should contain an array of repositories for each list.",
      );
    });

    it("should get repo lists from file", async () => {
      const existingFile = join(directory.path, "repository-lists.json");
      const repoLists = {
        list1: ["owner1/repo1", "owner2/repo2"],
        list2: ["owner3/repo3"],
      };
      await writeJson(existingFile, repoLists);
      getRemoteRepositoryListsPathSpy.mockReturnValue(existingFile);
      getRemoteRepositoryListsSpy.mockReturnValue({
        list3: ["onwer4/repo4"],
        list4: [],
      });

      quickPickSpy.mockResolvedValue({
        repositories: ["owner3/repo3"],
      } as unknown as QuickPickItem);

      const repoSelection = await getRepositorySelection();

      expect(repoSelection.repositoryLists).toBeUndefined();
      expect(repoSelection.owners).toBeUndefined();
      expect(repoSelection.repositories).toEqual(["owner3/repo3"]);
    });
  });
});
