import { faker } from "@faker-js/faker";
import { Octokit } from "@octokit/rest";
import { QuickPickItem, window } from "vscode";
import { mockedObject, mockedQuickPickItem } from "../../utils/mocking.helpers";
import {
  CodeqlDatabase,
  promptGitHubDatabaseDownload,
} from "../../../../src/databases/github-database-prompt";
import { DatabaseManager } from "../../../../src/databases/local-databases";
import { GitHubDatabaseConfig } from "../../../../src/config";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { createMockCommandManager } from "../../../__mocks__/commandsMock";
import * as databaseFetcher from "../../../../src/databases/database-fetcher";
import * as dialog from "../../../../src/common/vscode/dialog";

describe("promptGitHubDatabaseDownload", () => {
  let octokit: Octokit;
  const owner = "github";
  const repo = "codeql";
  let databaseManager: DatabaseManager;
  const setDownload = jest.fn();
  let config: GitHubDatabaseConfig;
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

  let showNeverAskAgainDialogSpy: jest.SpiedFunction<
    typeof dialog.showNeverAskAgainDialog
  >;
  let showQuickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let downloadGitHubDatabaseFromUrlSpy: jest.SpiedFunction<
    typeof databaseFetcher.downloadGitHubDatabaseFromUrl
  >;

  beforeEach(() => {
    octokit = mockedObject<Octokit>({});
    databaseManager = mockedObject<DatabaseManager>({});
    config = mockedObject<GitHubDatabaseConfig>({
      setDownload,
    });
    cliServer = mockedObject<CodeQLCliServer>({});

    showNeverAskAgainDialogSpy = jest
      .spyOn(dialog, "showNeverAskAgainDialog")
      .mockResolvedValue("Connect");
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
    await promptGitHubDatabaseDownload(
      octokit,
      owner,
      repo,
      databases,
      config,
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
    expect(showQuickPickSpy).not.toHaveBeenCalled();
    expect(config.setDownload).not.toHaveBeenCalled();
  });

  describe("when answering not now to prompt", () => {
    beforeEach(() => {
      showNeverAskAgainDialogSpy.mockResolvedValue("Not now");
    });

    it("does not download the database", async () => {
      await promptGitHubDatabaseDownload(
        octokit,
        owner,
        repo,
        databases,
        config,
        databaseManager,
        storagePath,
        cliServer,
        commandManager,
      );

      expect(downloadGitHubDatabaseFromUrlSpy).not.toHaveBeenCalled();
    });
  });

  describe("when cancelling prompt", () => {
    beforeEach(() => {
      showNeverAskAgainDialogSpy.mockResolvedValue(undefined);
    });

    it("does not download the database", async () => {
      await promptGitHubDatabaseDownload(
        octokit,
        owner,
        repo,
        databases,
        config,
        databaseManager,
        storagePath,
        cliServer,
        commandManager,
      );

      expect(downloadGitHubDatabaseFromUrlSpy).not.toHaveBeenCalled();
    });
  });

  describe("when answering never to prompt", () => {
    beforeEach(() => {
      showNeverAskAgainDialogSpy.mockResolvedValue("Never");
    });

    it("does not download the database", async () => {
      await promptGitHubDatabaseDownload(
        octokit,
        owner,
        repo,
        databases,
        config,
        databaseManager,
        storagePath,
        cliServer,
        commandManager,
      );

      expect(downloadGitHubDatabaseFromUrlSpy).not.toHaveBeenCalled();
    });

    it('sets the config to "never"', async () => {
      await promptGitHubDatabaseDownload(
        octokit,
        owner,
        repo,
        databases,
        config,
        databaseManager,
        storagePath,
        cliServer,
        commandManager,
      );

      expect(config.setDownload).toHaveBeenCalledTimes(1);
      expect(config.setDownload).toHaveBeenCalledWith("never");
    });
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

      await promptGitHubDatabaseDownload(
        octokit,
        owner,
        repo,
        databases,
        config,
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
      expect(config.setDownload).not.toHaveBeenCalled();
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

      await promptGitHubDatabaseDownload(
        octokit,
        owner,
        repo,
        databases,
        config,
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
      expect(config.setDownload).not.toHaveBeenCalled();
    });

    describe("when not selecting language", () => {
      beforeEach(() => {
        showQuickPickSpy.mockResolvedValue(undefined);
      });

      it("does not download the database", async () => {
        await promptGitHubDatabaseDownload(
          octokit,
          owner,
          repo,
          databases,
          config,
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
