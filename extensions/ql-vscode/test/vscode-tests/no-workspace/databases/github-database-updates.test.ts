import { faker } from "@faker-js/faker";
import { Octokit } from "@octokit/rest";
import { QuickPickItem, window } from "vscode";
import {
  mockDatabaseItem,
  mockedObject,
  mockedQuickPickItem,
} from "../../utils/mocking.helpers";
import { CodeqlDatabase } from "../../../../src/databases/github-database-api";
import { DatabaseManager } from "../../../../src/databases/local-databases";
import { GitHubDatabaseConfig } from "../../../../src/config";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { createMockCommandManager } from "../../../__mocks__/commandsMock";
import * as databaseFetcher from "../../../../src/databases/database-fetcher";
import * as dialog from "../../../../src/common/vscode/dialog";
import {
  DatabaseUpdate,
  askForGitHubDatabaseUpdate,
  downloadDatabaseUpdateFromGitHub,
  isNewerDatabaseAvailable,
} from "../../../../src/databases/github-database-updates";

describe("isNewerDatabaseAvailable", () => {
  const owner = "github";
  const repo = "codeql";
  let databases: CodeqlDatabase[];
  let databaseManager: DatabaseManager;

  describe("when there are updates", () => {
    beforeEach(() => {
      databases = [
        mockedObject<CodeqlDatabase>({
          language: "java",
          commit_oid: "58e7476df3e464a0c9742b14cd4ca274b0993ebb",
        }),
        mockedObject<CodeqlDatabase>({
          language: "swift",
          commit_oid: "b81c25c0b73dd3c242068e8ab38bef25563a7c2d",
        }),
        mockedObject<CodeqlDatabase>({
          language: "javascript",
          commit_oid: "6e93915ff37ff8bcfc552d48f118895d60d0e7cd",
        }),
        mockedObject<CodeqlDatabase>({
          language: "ql",
          commit_oid: "9448fbfb88cdefe4298cc2e234a5a3c98958cae8",
        }),
      ];

      databaseManager = mockedObject<DatabaseManager>({
        databaseItems: [
          mockDatabaseItem({
            dateAdded: 1600477451789,
            language: "java",
            origin: {
              type: "github",
              repository: "github/codeql",
              commitOid: "4487d1da9665231d1a076c60a78523f6275ad70f",
            },
          }),
          mockDatabaseItem({
            dateAdded: 50,
            language: "swift",
            origin: {
              type: "github",
              repository: "github/codeql",
              commitOid: "2b020927d3c6eb407223a1baa3d6ce3597a3f88d",
            },
          }),
          mockDatabaseItem({
            dateAdded: 1700477451789,
            language: "java",
            origin: {
              type: "github",
              repository: "github/codeql",
              commitOid: "17663af4e84a3a010fcb3f09cc06049797dfb22a",
            },
          }),
          mockDatabaseItem({
            dateAdded: faker.date.past().getTime(),
            language: "golang",
            origin: {
              type: "github",
              repository: "github/codeql",
            },
          }),
          mockDatabaseItem({
            dateAdded: faker.date.past().getTime(),
            language: "ql",
            origin: {
              type: "github",
              repository: "github/codeql",
            },
          }),
          mockDatabaseItem({
            language: "javascript",
            origin: {
              type: "github",
              repository: "github/vscode-codeql",
              commitOid: "fb360f9c09ac8c5edb2f18be5de4e80ea4c430d0",
            },
          }),
        ],
      });
    });

    it("returns the correct status", async () => {
      expect(
        isNewerDatabaseAvailable(databases, owner, repo, databaseManager),
      ).toEqual({
        type: "updateAvailable",
        databaseUpdates: [
          {
            database: databases[0],
            databaseItem: databaseManager.databaseItems[2],
          },
          {
            database: databases[3],
            databaseItem: databaseManager.databaseItems[4],
          },
          {
            database: databases[1],
            databaseItem: databaseManager.databaseItems[1],
          },
        ],
      });
    });
  });

  describe("when there are no updates", () => {
    beforeEach(() => {
      databases = [
        mockedObject<CodeqlDatabase>({
          language: "java",
          commit_oid: "17663af4e84a3a010fcb3f09cc06049797dfb22a",
        }),
      ];

      databaseManager = mockedObject<DatabaseManager>({
        databaseItems: [
          mockDatabaseItem({
            dateAdded: 1700477451789,
            language: "java",
            origin: {
              type: "github",
              repository: "github/codeql",
              commitOid: "17663af4e84a3a010fcb3f09cc06049797dfb22a",
            },
          }),
          mockDatabaseItem({
            dateAdded: 1600477451789,
            language: "java",
            origin: {
              type: "github",
              repository: "github/codeql",
              commitOid: "4487d1da9665231d1a076c60a78523f6275ad70f",
            },
          }),
        ],
      });
    });

    it("returns the correct status", async () => {
      expect(
        isNewerDatabaseAvailable(databases, owner, repo, databaseManager),
      ).toEqual({
        type: "upToDate",
      });
    });
  });

  describe("when there are no matching database items", () => {
    beforeEach(() => {
      databases = [
        mockedObject<CodeqlDatabase>({
          language: "java",
          commit_oid: "17663af4e84a3a010fcb3f09cc06049797dfb22a",
        }),
      ];

      databaseManager = mockedObject<DatabaseManager>({
        databaseItems: [
          mockDatabaseItem({
            language: "javascript",
            origin: {
              type: "github",
              repository: "github/vscode-codeql",
              commitOid: "fb360f9c09ac8c5edb2f18be5de4e80ea4c430d0",
            },
          }),
        ],
      });
    });

    it("returns the correct status", async () => {
      expect(
        isNewerDatabaseAvailable(databases, owner, repo, databaseManager),
      ).toEqual({
        type: "noDatabase",
      });
    });
  });
});

describe("askForGitHubDatabaseUpdate", () => {
  const setUpdate = jest.fn();
  let config: GitHubDatabaseConfig;

  const updates: DatabaseUpdate[] = [
    {
      database: mockedObject<CodeqlDatabase>({
        id: faker.number.int(),
        created_at: faker.date.past().toISOString(),
        commit_oid: faker.git.commitSha(),
        language: "swift",
        size: 27389673,
        url: faker.internet.url({
          protocol: "https",
        }),
      }),
      databaseItem: mockDatabaseItem(),
    },
  ];

  let showNeverAskAgainDialogSpy: jest.SpiedFunction<
    typeof dialog.showNeverAskAgainDialog
  >;

  beforeEach(() => {
    config = mockedObject<GitHubDatabaseConfig>({
      setUpdate,
    });

    showNeverAskAgainDialogSpy = jest.spyOn(dialog, "showNeverAskAgainDialog");
  });

  describe("when answering download to prompt", () => {
    beforeEach(() => {
      showNeverAskAgainDialogSpy.mockResolvedValue("Download");
    });

    it("returns false", async () => {
      expect(await askForGitHubDatabaseUpdate(updates, config)).toEqual(true);

      expect(setUpdate).not.toHaveBeenCalled();
    });
  });

  describe("when answering not now to prompt", () => {
    beforeEach(() => {
      showNeverAskAgainDialogSpy.mockResolvedValue("Not now");
    });

    it("returns false", async () => {
      expect(await askForGitHubDatabaseUpdate(updates, config)).toEqual(false);

      expect(setUpdate).not.toHaveBeenCalled();
    });
  });

  describe("when cancelling prompt", () => {
    beforeEach(() => {
      showNeverAskAgainDialogSpy.mockResolvedValue(undefined);
    });

    it("returns false", async () => {
      expect(await askForGitHubDatabaseUpdate(updates, config)).toEqual(false);

      expect(setUpdate).not.toHaveBeenCalled();
    });
  });

  describe("when answering never to prompt", () => {
    beforeEach(() => {
      showNeverAskAgainDialogSpy.mockResolvedValue("Never");
    });

    it("returns false", async () => {
      expect(await askForGitHubDatabaseUpdate(updates, config)).toEqual(false);
    });

    it("sets the config to never", async () => {
      await askForGitHubDatabaseUpdate(updates, config);

      expect(setUpdate).toHaveBeenCalledWith("never");
    });
  });
});

describe("downloadDatabaseUpdateFromGitHub", () => {
  let octokit: Octokit;
  const owner = "github";
  const repo = "codeql";
  let databaseManager: DatabaseManager;
  const storagePath = "/a/b/c/d";
  let cliServer: CodeQLCliServer;
  const commandManager = createMockCommandManager();

  let updates: DatabaseUpdate[] = [
    {
      database: mockedObject<CodeqlDatabase>({
        id: faker.number.int(),
        created_at: faker.date.past().toISOString(),
        commit_oid: faker.git.commitSha(),
        language: "swift",
        size: 27389673,
        url: faker.internet.url({
          protocol: "https",
        }),
      }),
      databaseItem: mockDatabaseItem({
        hasSourceArchiveInExplorer: () => false,
      }),
    },
  ];

  let showQuickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let downloadGitHubDatabaseFromUrlSpy: jest.SpiedFunction<
    typeof databaseFetcher.downloadGitHubDatabaseFromUrl
  >;

  beforeEach(() => {
    octokit = mockedObject<Octokit>({});
    databaseManager = mockedObject<DatabaseManager>({
      currentDatabaseItem: mockDatabaseItem(),
    });
    cliServer = mockedObject<CodeQLCliServer>({});

    showQuickPickSpy = jest.spyOn(window, "showQuickPick").mockResolvedValue(
      mockedQuickPickItem([
        mockedObject<QuickPickItem & { database: CodeqlDatabase }>({
          database: updates[0].database,
        }),
      ]),
    );
    downloadGitHubDatabaseFromUrlSpy = jest
      .spyOn(databaseFetcher, "downloadGitHubDatabaseFromUrl")
      .mockResolvedValue(undefined);
  });

  it("downloads the database", async () => {
    await downloadDatabaseUpdateFromGitHub(
      octokit,
      owner,
      repo,
      updates,
      databaseManager,
      storagePath,
      cliServer,
      commandManager,
    );

    expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledTimes(1);
    expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledWith(
      updates[0].database.url,
      updates[0].database.id,
      updates[0].database.created_at,
      updates[0].database.commit_oid,
      owner,
      repo,
      octokit,
      expect.anything(),
      databaseManager,
      storagePath,
      cliServer,
      false,
      false,
    );
    expect(showQuickPickSpy).not.toHaveBeenCalled();
  });

  describe("when there are multiple languages", () => {
    beforeEach(() => {
      updates = [
        {
          database: mockedObject<CodeqlDatabase>({
            id: faker.number.int(),
            created_at: faker.date.past().toISOString(),
            commit_oid: faker.git.commitSha(),
            language: "swift",
            size: 27389673,
            url: faker.internet.url({
              protocol: "https",
            }),
          }),
          databaseItem: mockDatabaseItem({
            hasSourceArchiveInExplorer: () => false,
          }),
        },
        {
          database: mockedObject<CodeqlDatabase>({
            id: faker.number.int(),
            created_at: faker.date.past().toISOString(),
            commit_oid: null,
            language: "go",
            size: 2930572385,
            url: faker.internet.url({
              protocol: "https",
            }),
          }),
          databaseItem: mockDatabaseItem({
            hasSourceArchiveInExplorer: () => true,
          }),
        },
      ];

      databaseManager = mockedObject<DatabaseManager>({
        currentDatabaseItem: updates[1].databaseItem,
      });
    });

    it("downloads a single selected language", async () => {
      showQuickPickSpy.mockResolvedValue(
        mockedQuickPickItem([
          mockedObject<QuickPickItem & { database: CodeqlDatabase }>({
            database: updates[1].database,
          }),
        ]),
      );

      await downloadDatabaseUpdateFromGitHub(
        octokit,
        owner,
        repo,
        updates,
        databaseManager,
        storagePath,
        cliServer,
        commandManager,
      );

      expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledTimes(1);
      expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledWith(
        updates[1].database.url,
        updates[1].database.id,
        updates[1].database.created_at,
        updates[1].database.commit_oid,
        owner,
        repo,
        octokit,
        expect.anything(),
        databaseManager,
        storagePath,
        cliServer,
        true,
        true,
      );
      expect(showQuickPickSpy).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            label: "Go",
            description: "2794.8 MB",
            database: updates[1].database,
          }),
          expect.objectContaining({
            label: "Swift",
            description: "26.1 MB",
            database: updates[0].database,
          }),
        ],
        expect.anything(),
      );
    });

    it("downloads multiple selected languages", async () => {
      showQuickPickSpy.mockResolvedValue(
        mockedQuickPickItem([
          mockedObject<QuickPickItem & { database: CodeqlDatabase }>({
            database: updates[0].database,
          }),
          mockedObject<QuickPickItem & { database: CodeqlDatabase }>({
            database: updates[1].database,
          }),
        ]),
      );

      await downloadDatabaseUpdateFromGitHub(
        octokit,
        owner,
        repo,
        updates,
        databaseManager,
        storagePath,
        cliServer,
        commandManager,
      );

      expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledTimes(2);
      expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledWith(
        updates[0].database.url,
        updates[0].database.id,
        updates[0].database.created_at,
        updates[0].database.commit_oid,
        owner,
        repo,
        octokit,
        expect.anything(),
        databaseManager,
        storagePath,
        cliServer,
        false,
        false,
      );
      expect(downloadGitHubDatabaseFromUrlSpy).toHaveBeenCalledWith(
        updates[1].database.url,
        updates[1].database.id,
        updates[1].database.created_at,
        updates[1].database.commit_oid,
        owner,
        repo,
        octokit,
        expect.anything(),
        databaseManager,
        storagePath,
        cliServer,
        true,
        true,
      );
      expect(showQuickPickSpy).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            label: "Go",
            description: "2794.8 MB",
            database: updates[1].database,
          }),
          expect.objectContaining({
            label: "Swift",
            description: "26.1 MB",
            database: updates[0].database,
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
        await downloadDatabaseUpdateFromGitHub(
          octokit,
          owner,
          repo,
          updates,
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
