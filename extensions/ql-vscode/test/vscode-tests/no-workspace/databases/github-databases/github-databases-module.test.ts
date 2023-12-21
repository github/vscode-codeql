import { window } from "vscode";
import { Octokit } from "@octokit/rest";
import { createMockApp } from "../../../../__mocks__/appMock";
import { App } from "../../../../../src/common/app";
import { DatabaseManager } from "../../../../../src/databases/local-databases";
import { mockEmptyDatabaseManager } from "../../query-testing/test-runner-helpers";
import { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import { mockDatabaseItem, mockedObject } from "../../../utils/mocking.helpers";
import { GitHubDatabaseConfig } from "../../../../../src/config";
import { GitHubDatabasesModule } from "../../../../../src/databases/github-databases";
import { ValueResult } from "../../../../../src/common/value-result";
import { CodeqlDatabase } from "../../../../../src/databases/github-databases/api";

import * as githubRepositoryFinder from "../../../../../src/databases/github-repository-finder";
import * as githubDatabasesApi from "../../../../../src/databases/github-databases/api";
import * as githubDatabasesDownload from "../../../../../src/databases/github-databases/download";
import * as githubDatabasesUpdates from "../../../../../src/databases/github-databases/updates";
import { DatabaseUpdate } from "../../../../../src/databases/github-databases/updates";

describe("GitHubDatabasesModule", () => {
  describe("promptGitHubRepositoryDownload", () => {
    let app: App;
    let databaseManager: DatabaseManager;
    let databaseStoragePath: string;
    let cliServer: CodeQLCliServer;
    let config: GitHubDatabaseConfig;
    let gitHubDatabasesModule: GitHubDatabasesModule;

    const owner = "github";
    const repo = "vscode-codeql";

    const databases: CodeqlDatabase[] = [
      mockedObject<CodeqlDatabase>({}),
      mockedObject<CodeqlDatabase>({}),
    ];

    let octokit: Octokit;

    let findGitHubRepositoryForWorkspaceSpy: jest.SpiedFunction<
      typeof githubRepositoryFinder.findGitHubRepositoryForWorkspace
    >;
    let listDatabasesSpy: jest.SpiedFunction<
      typeof githubDatabasesApi.listDatabases
    >;
    let askForGitHubDatabaseDownloadSpy: jest.SpiedFunction<
      typeof githubDatabasesDownload.askForGitHubDatabaseDownload
    >;
    let downloadDatabaseFromGitHubSpy: jest.SpiedFunction<
      typeof githubDatabasesDownload.downloadDatabaseFromGitHub
    >;
    let isNewerDatabaseAvailableSpy: jest.SpiedFunction<
      typeof githubDatabasesUpdates.isNewerDatabaseAvailable
    >;
    let askForGitHubDatabaseUpdateSpy: jest.SpiedFunction<
      typeof githubDatabasesUpdates.askForGitHubDatabaseUpdate
    >;
    let downloadDatabaseUpdateFromGitHubSpy: jest.SpiedFunction<
      typeof githubDatabasesUpdates.downloadDatabaseUpdateFromGitHub
    >;
    let showInformationMessageSpy: jest.SpiedFunction<
      typeof window.showInformationMessage
    >;

    beforeEach(() => {
      app = createMockApp();
      databaseManager = mockEmptyDatabaseManager();
      databaseStoragePath = "/a/b/some-path";
      cliServer = mockedObject<CodeQLCliServer>({});
      config = mockedObject<GitHubDatabaseConfig>({
        download: "ask",
        update: "ask",
      });

      gitHubDatabasesModule = new GitHubDatabasesModule(
        app,
        databaseManager,
        databaseStoragePath,
        cliServer,
        config,
      );

      octokit = mockedObject<Octokit>({});

      findGitHubRepositoryForWorkspaceSpy = jest
        .spyOn(githubRepositoryFinder, "findGitHubRepositoryForWorkspace")
        .mockResolvedValue(ValueResult.ok({ owner, name: repo }));

      listDatabasesSpy = jest
        .spyOn(githubDatabasesApi, "listDatabases")
        .mockResolvedValue({
          promptedForCredentials: false,
          databases,
          octokit,
        });

      askForGitHubDatabaseDownloadSpy = jest
        .spyOn(githubDatabasesDownload, "askForGitHubDatabaseDownload")
        .mockRejectedValue(new Error("Not implemented"));
      downloadDatabaseFromGitHubSpy = jest
        .spyOn(githubDatabasesDownload, "downloadDatabaseFromGitHub")
        .mockRejectedValue(new Error("Not implemented"));
      isNewerDatabaseAvailableSpy = jest
        .spyOn(githubDatabasesUpdates, "isNewerDatabaseAvailable")
        .mockImplementation(() => {
          throw new Error("Not implemented");
        });
      askForGitHubDatabaseUpdateSpy = jest
        .spyOn(githubDatabasesUpdates, "askForGitHubDatabaseUpdate")
        .mockRejectedValue(new Error("Not implemented"));
      downloadDatabaseUpdateFromGitHubSpy = jest
        .spyOn(githubDatabasesUpdates, "downloadDatabaseUpdateFromGitHub")
        .mockRejectedValue(new Error("Not implemented"));

      showInformationMessageSpy = jest
        .spyOn(window, "showInformationMessage")
        .mockResolvedValue(undefined);
    });

    it("does nothing if the download config is set to never", async () => {
      config = mockedObject<GitHubDatabaseConfig>({
        download: "never",
      });

      gitHubDatabasesModule = new GitHubDatabasesModule(
        app,
        databaseManager,
        databaseStoragePath,
        cliServer,
        config,
      );

      await gitHubDatabasesModule.promptGitHubRepositoryDownload();

      expect(findGitHubRepositoryForWorkspaceSpy).not.toHaveBeenCalled();
    });

    it("does nothing if there is no GitHub repository", async () => {
      findGitHubRepositoryForWorkspaceSpy.mockResolvedValue(
        ValueResult.fail(["some error"]),
      );

      await gitHubDatabasesModule.promptGitHubRepositoryDownload();
    });

    it("does nothing if the user doesn't complete the download", async () => {
      listDatabasesSpy.mockResolvedValue(undefined);

      await gitHubDatabasesModule.promptGitHubRepositoryDownload();
    });

    it("does not show a prompt when there are no databases and the user was not prompted for credentials", async () => {
      listDatabasesSpy.mockResolvedValue({
        promptedForCredentials: false,
        databases: [],
        octokit,
      });

      await gitHubDatabasesModule.promptGitHubRepositoryDownload();

      expect(showInformationMessageSpy).not.toHaveBeenCalled();
    });

    it("shows a prompt when there are no databases and the user was prompted for credentials", async () => {
      listDatabasesSpy.mockResolvedValue({
        promptedForCredentials: true,
        databases: [],
        octokit,
      });

      await gitHubDatabasesModule.promptGitHubRepositoryDownload();

      expect(showInformationMessageSpy).toHaveBeenCalledWith(
        "The GitHub repository does not have any CodeQL databases.",
      );
    });

    it("shows a prompt when there are no databases and the user was prompted for credentials", async () => {
      listDatabasesSpy.mockResolvedValue({
        promptedForCredentials: true,
        databases: [],
        octokit,
      });

      await gitHubDatabasesModule.promptGitHubRepositoryDownload();

      expect(showInformationMessageSpy).toHaveBeenCalledWith(
        "The GitHub repository does not have any CodeQL databases.",
      );
    });

    it("downloads the database if the user confirms the download", async () => {
      isNewerDatabaseAvailableSpy.mockReturnValue({
        type: "noDatabase",
      });
      askForGitHubDatabaseDownloadSpy.mockResolvedValue(true);
      downloadDatabaseFromGitHubSpy.mockResolvedValue(undefined);

      await gitHubDatabasesModule.promptGitHubRepositoryDownload();

      expect(askForGitHubDatabaseDownloadSpy).toHaveBeenCalledWith(
        databases,
        config,
      );
      expect(downloadDatabaseFromGitHubSpy).toHaveBeenCalledWith(
        octokit,
        owner,
        repo,
        databases,
        databaseManager,
        databaseStoragePath,
        cliServer,
        app.commands,
      );
    });

    it("does not perform the download if the user cancels the download", async () => {
      isNewerDatabaseAvailableSpy.mockReturnValue({
        type: "noDatabase",
      });
      askForGitHubDatabaseDownloadSpy.mockResolvedValue(false);

      await gitHubDatabasesModule.promptGitHubRepositoryDownload();

      expect(downloadDatabaseFromGitHubSpy).not.toHaveBeenCalled();
    });

    it("updates the database if the user confirms the update", async () => {
      const databaseUpdates: DatabaseUpdate[] = [
        {
          database: databases[0],
          databaseItem: mockDatabaseItem(),
        },
      ];
      isNewerDatabaseAvailableSpy.mockReturnValue({
        type: "updateAvailable",
        databaseUpdates,
      });
      askForGitHubDatabaseUpdateSpy.mockResolvedValue(true);
      downloadDatabaseUpdateFromGitHubSpy.mockResolvedValue(undefined);

      await gitHubDatabasesModule.promptGitHubRepositoryDownload();

      expect(askForGitHubDatabaseUpdateSpy).toHaveBeenCalledWith(
        databaseUpdates,
        config,
      );
      expect(downloadDatabaseUpdateFromGitHubSpy).toHaveBeenCalledWith(
        octokit,
        owner,
        repo,
        databaseUpdates,
        databaseManager,
        databaseStoragePath,
        cliServer,
        app.commands,
      );
    });

    it("does not perform the update if the user cancels the update", async () => {
      const databaseUpdates: DatabaseUpdate[] = [
        {
          database: databases[0],
          databaseItem: mockDatabaseItem(),
        },
      ];
      isNewerDatabaseAvailableSpy.mockReturnValue({
        type: "updateAvailable",
        databaseUpdates,
      });
      askForGitHubDatabaseUpdateSpy.mockResolvedValue(false);

      await gitHubDatabasesModule.promptGitHubRepositoryDownload();

      expect(downloadDatabaseUpdateFromGitHubSpy).not.toHaveBeenCalled();
    });
  });
});
