import { faker } from "@faker-js/faker";
import { Octokit } from "@octokit/rest";
import { QuickPickItem, window } from "vscode";
import { mockedObject, mockedQuickPickItem } from "../../utils/mocking.helpers";
import {
  askForGitHubDatabaseDownload,
  downloadDatabaseFromGitHub,
} from "../../../../src/databases/github-database-download";
import { DatabaseManager } from "../../../../src/databases/local-databases";
import { GitHubDatabaseConfig } from "../../../../src/config";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { createMockCommandManager } from "../../../__mocks__/commandsMock";
import * as databaseFetcher from "../../../../src/databases/database-fetcher";
import * as dialog from "../../../../src/common/vscode/dialog";
import { CodeqlDatabase } from "../../../../src/databases/github-database-api";

describe("askForGitHubDatabaseDownload", () => {
  const setDownload = jest.fn();
  let config: GitHubDatabaseConfig;

  const databases = [
    mockedObject<CodeqlDatabase>({
      language: "swift",
      url: faker.internet.url({
        protocol: "https",
      }),
    }),
  ];

  let showNeverAskAgainDialogSpy: jest.SpiedFunction<
    typeof dialog.showNeverAskAgainDialog
  >;

  beforeEach(() => {
    config = mockedObject<GitHubDatabaseConfig>({
      setDownload,
    });

    showNeverAskAgainDialogSpy = jest
      .spyOn(dialog, "showNeverAskAgainDialog")
      .mockResolvedValue("Connect");
  });

  describe("when answering not now to prompt", () => {
    beforeEach(() => {
      showNeverAskAgainDialogSpy.mockResolvedValue("Not now");
    });

    it("returns false", async () => {
      expect(await askForGitHubDatabaseDownload(databases, config)).toEqual(
        false,
      );

      expect(setDownload).not.toHaveBeenCalled();
    });
  });

  describe("when cancelling prompt", () => {
    beforeEach(() => {
      showNeverAskAgainDialogSpy.mockResolvedValue(undefined);
    });

    it("returns false", async () => {
      expect(await askForGitHubDatabaseDownload(databases, config)).toEqual(
        false,
      );

      expect(setDownload).not.toHaveBeenCalled();
    });
  });

  describe("when answering never to prompt", () => {
    beforeEach(() => {
      showNeverAskAgainDialogSpy.mockResolvedValue("Never");
    });

    it("returns false", async () => {
      expect(await askForGitHubDatabaseDownload(databases, config)).toEqual(
        false,
      );
    });

    it("sets the config to never", async () => {
      await askForGitHubDatabaseDownload(databases, config);

      expect(setDownload).toHaveBeenCalledWith("never");
    });
  });
});

describe("downloadDatabaseFromGitHub", () => {
  let octokit: Octokit;
  const owner = "github";
  const repo = "codeql";
  let databaseManager: DatabaseManager;

  const storagePath = "/a/b/c/d";
  let cliServer: CodeQLCliServer;
  const commandManager = createMockCommandManager();

  let databases = [
    mockedObject<CodeqlDatabase>({
      id: faker.number.int(),
      created_at: faker.date.past().toISOString(),
      commit_oid: faker.git.commitSha(),
      language: "swift",
      size: 27389673,
      url: faker.internet.url({
        protocol: "https",
      }),
    }),
  ];

  let showQuickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let downloadGitHubDatabaseFromUrlSpy: jest.SpiedFunction<
    typeof databaseFetcher.downloadGitHubDatabaseFromUrl
  >;

  beforeEach(() => {
    octokit = mockedObject<Octokit>({});
    databaseManager = mockedObject<DatabaseManager>({});
    cliServer = mockedObject<CodeQLCliServer>({});

    showQuickPickSpy = jest.spyOn(window, "showQuickPick").mockResolvedValue(
      mockedQuickPickItem([
        mockedObject<QuickPickItem & { database: CodeqlDatabase }>({
          database: databases[0],
        }),
      ]),
    );
    downloadGitHubDatabaseFromUrlSpy = jest
      .spyOn(databaseFetcher, "downloadGitHubDatabaseFromUrl")
      .mockResolvedValue(undefined);
  });

  it("downloads the database", async () => {
    await downloadDatabaseFromGitHub(
      octokit,
      owner,
      repo,
      databases,
      databaseManager,
      storagePath,
      cliServer,
      commandManager,
    );

    expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledTimes(1);
    expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledWith(
      databases[0].url,
      databases[0].id,
      databases[0].created_at,
      databases[0].commit_oid,
      owner,
      repo,
      octokit,
      expect.anything(),
      databaseManager,
      storagePath,
      cliServer,
      true,
      false,
    );
  });

  describe("when there are multiple languages", () => {
    beforeEach(() => {
      databases = [
        mockedObject<CodeqlDatabase>({
          id: faker.number.int(),
          created_at: faker.date.past().toISOString(),
          commit_oid: faker.git.commitSha(),
          language: "swift",
          size: 27389673,
          url: faker.internet.url({
            protocol: "https",
          }),
        }),
        mockedObject<CodeqlDatabase>({
          id: faker.number.int(),
          created_at: faker.date.past().toISOString(),
          commit_oid: null,
          language: "go",
          size: 2930572385,
          url: faker.internet.url({
            protocol: "https",
          }),
        }),
      ];
    });

    it("downloads a single selected language", async () => {
      showQuickPickSpy.mockResolvedValue(
        mockedQuickPickItem([
          mockedObject<QuickPickItem & { database: CodeqlDatabase }>({
            database: databases[1],
          }),
        ]),
      );

      await downloadDatabaseFromGitHub(
        octokit,
        owner,
        repo,
        databases,
        databaseManager,
        storagePath,
        cliServer,
        commandManager,
      );

      expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledTimes(1);
      expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledWith(
        databases[1].url,
        databases[1].id,
        databases[1].created_at,
        databases[1].commit_oid,
        owner,
        repo,
        octokit,
        expect.anything(),
        databaseManager,
        storagePath,
        cliServer,
        true,
        false,
      );
      expect(showQuickPickSpy).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            label: "Go",
            description: "2794.8 MB",
            database: databases[1],
          }),
          expect.objectContaining({
            label: "Swift",
            description: "26.1 MB",
            database: databases[0],
          }),
        ],
        expect.anything(),
      );
    });

    it("downloads multiple selected languages", async () => {
      showQuickPickSpy.mockResolvedValue(
        mockedQuickPickItem([
          mockedObject<QuickPickItem & { database: CodeqlDatabase }>({
            database: databases[0],
          }),
          mockedObject<QuickPickItem & { database: CodeqlDatabase }>({
            database: databases[1],
          }),
        ]),
      );

      await downloadDatabaseFromGitHub(
        octokit,
        owner,
        repo,
        databases,
        databaseManager,
        storagePath,
        cliServer,
        commandManager,
      );

      expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledTimes(2);
      expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledWith(
        databases[0].url,
        databases[0].id,
        databases[0].created_at,
        databases[0].commit_oid,
        owner,
        repo,
        octokit,
        expect.anything(),
        databaseManager,
        storagePath,
        cliServer,
        true,
        false,
      );
      expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledWith(
        databases[1].url,
        databases[1].id,
        databases[1].created_at,
        databases[1].commit_oid,
        owner,
        repo,
        octokit,
        expect.anything(),
        databaseManager,
        storagePath,
        cliServer,
        true,
        false,
      );
      expect(showQuickPickSpy).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            label: "Go",
            description: "2794.8 MB",
            database: databases[1],
          }),
          expect.objectContaining({
            label: "Swift",
            description: "26.1 MB",
            database: databases[0],
          }),
        ],
        expect.anything(),
      );
    });

    describe("when not selecting language", () => {
      beforeEach(() => {
        showQuickPickSpy.mockResolvedValue(undefined);
      });

      it("does not download the database", async () => {
        await downloadDatabaseFromGitHub(
          octokit,
          owner,
          repo,
          databases,
          databaseManager,
          storagePath,
          cliServer,
          commandManager,
        );

        expect(downloadGitHubDatabaseFromUrlSpy).not.toHaveBeenCalled();
      });
    });
  });
});
