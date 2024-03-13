import { faker } from "@faker-js/faker";
import type { Octokit } from "@octokit/rest";
import type { QuickPickItem } from "vscode";
import { window } from "vscode";
import {
  mockDatabaseItem,
  mockedObject,
  mockedQuickPickItem,
} from "../../../utils/mocking.helpers";
import type { CodeqlDatabase } from "../../../../../src/databases/github-databases/api";
import type { DatabaseManager } from "../../../../../src/databases/local-databases";
import type { GitHubDatabaseConfig } from "../../../../../src/config";
import type { DatabaseFetcher } from "../../../../../src/databases/database-fetcher";
import * as dialog from "../../../../../src/common/vscode/dialog";
import type { DatabaseUpdate } from "../../../../../src/databases/github-databases/updates";
import {
  askForGitHubDatabaseUpdate,
  downloadDatabaseUpdateFromGitHub,
  isNewerDatabaseAvailable,
} from "../../../../../src/databases/github-databases/updates";
import { createMockApp } from "../../../../__mocks__/appMock";

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
          created_at: "2023-11-22T09:20:59.185Z",
        }),
        mockedObject<CodeqlDatabase>({
          language: "swift",
          commit_oid: "b81c25c0b73dd3c242068e8ab38bef25563a7c2d",
          created_at: "2023-11-22T09:21:53.257Z",
        }),
        mockedObject<CodeqlDatabase>({
          language: "javascript",
          commit_oid: "6e93915ff37ff8bcfc552d48f118895d60d0e7cd",
          created_at: "2023-11-20T09:20:52.185Z",
        }),
        mockedObject<CodeqlDatabase>({
          language: "ql",
          commit_oid: "9448fbfb88cdefe4298cc2e234a5a3c98958cae8",
          created_at: "2023-11-21T09:20:59.185Z",
        }),
        mockedObject<CodeqlDatabase>({
          language: "ruby",
          commit_oid: "30220ebe8a36a22c4b6200fd207476d03717be4c",
          created_at: "2023-11-23T09:20:59.185Z",
        }),
        mockedObject<CodeqlDatabase>({
          language: "csharp",
          commit_oid: "1dad8b67751834ea61344effacf3ac8a88929289",
          created_at: "2023-11-20T09:20:59.185Z",
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
              databaseCreatedAt: "2023-10-22T09:20:59.185Z",
            },
          }),
          mockDatabaseItem({
            dateAdded: 50,
            language: "swift",
            origin: {
              type: "github",
              repository: "github/codeql",
              commitOid: "2b020927d3c6eb407223a1baa3d6ce3597a3f88d",
              databaseCreatedAt: "2023-10-22T09:20:59.185Z",
            },
          }),
          mockDatabaseItem({
            dateAdded: 1700477451789,
            language: "java",
            origin: {
              type: "github",
              repository: "github/codeql",
              commitOid: "17663af4e84a3a010fcb3f09cc06049797dfb22a",
              databaseCreatedAt: "2023-10-22T09:20:59.185Z",
            },
          }),
          mockDatabaseItem({
            dateAdded: faker.date.past().getTime(),
            language: "golang",
            origin: {
              type: "github",
              repository: "github/codeql",
              databaseCreatedAt: "2023-10-22T09:19:59.185Z",
            },
          }),
          mockDatabaseItem({
            dateAdded: faker.date.past().getTime(),
            language: "ql",
            origin: {
              type: "github",
              repository: "github/codeql",
              databaseCreatedAt: "2023-10-20T09:20:59.185Z",
            },
          }),
          mockDatabaseItem({
            language: "javascript",
            origin: {
              type: "github",
              repository: "github/vscode-codeql",
              commitOid: "fb360f9c09ac8c5edb2f18be5de4e80ea4c430d0",
              databaseCreatedAt: "2023-10-22T09:20:59.185Z",
            },
          }),
          mockDatabaseItem({
            dateAdded: faker.date.past().getTime(),
            language: "ruby",
            origin: {
              type: "github",
              repository: "github/codeql",
              commitOid: "30220ebe8a36a22c4b6200fd207476d03717be4c",
              databaseCreatedAt: "2023-10-22T09:20:59.185Z",
            },
          }),
          mockDatabaseItem({
            dateAdded: faker.date.past().getTime(),
            language: "csharp",
            origin: {
              type: "github",
              repository: "github/codeql",
              commitOid: "1dad8b67751834ea61344effacf3ac8a88929289",
              databaseCreatedAt: "2023-11-23T09:20:59.185Z",
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
          // java: different commit_oid, last dateAdded
          {
            database: databases[0],
            databaseItem: databaseManager.databaseItems[2],
          },
          {
            // ql: commit_oid on remote, not on local
            database: databases[3],
            databaseItem: databaseManager.databaseItems[4],
          },
          {
            // swift: different commit_oid
            database: databases[1],
            databaseItem: databaseManager.databaseItems[1],
          },
          {
            // ruby: same commit_oid, newer created_at
            database: databases[4],
            databaseItem: databaseManager.databaseItems[6],
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
          created_at: "2023-11-22T09:21:53.257Z",
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
              databaseCreatedAt: "2023-11-22T09:21:53.257Z",
            },
          }),
          mockDatabaseItem({
            dateAdded: 1600477451789,
            language: "java",
            origin: {
              type: "github",
              repository: "github/codeql",
              commitOid: "4487d1da9665231d1a076c60a78523f6275ad70f",
              databaseCreatedAt: "2023-10-22T09:20:59.185Z",
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
  let databaseFetcher: DatabaseFetcher;
  const app = createMockApp();

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
  let downloadGitHubDatabaseFromUrlMock: jest.MockedFunction<
    DatabaseFetcher["downloadGitHubDatabaseFromUrl"]
  >;

  beforeEach(() => {
    octokit = mockedObject<Octokit>({});
    databaseManager = mockedObject<DatabaseManager>({
      currentDatabaseItem: mockDatabaseItem(),
    });

    downloadGitHubDatabaseFromUrlMock = jest.fn().mockReturnValue(undefined);
    databaseFetcher = mockedObject<DatabaseFetcher>({
      downloadGitHubDatabaseFromUrl: downloadGitHubDatabaseFromUrlMock,
    });

    showQuickPickSpy = jest.spyOn(window, "showQuickPick").mockResolvedValue(
      mockedQuickPickItem([
        mockedObject<QuickPickItem & { database: CodeqlDatabase }>({
          database: updates[0].database,
        }),
      ]),
    );
  });

  it("downloads the database", async () => {
    await downloadDatabaseUpdateFromGitHub(
      octokit,
      owner,
      repo,
      updates,
      databaseManager,
      databaseFetcher,
      app.commands,
    );

    expect(downloadGitHubDatabaseFromUrlMock).toHaveBeenCalledTimes(1);
    expect(downloadGitHubDatabaseFromUrlMock).toHaveBeenCalledWith(
      updates[0].database.url,
      updates[0].database.id,
      updates[0].database.created_at,
      updates[0].database.commit_oid,
      owner,
      repo,
      octokit,
      expect.anything(),
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
        databaseFetcher,
        app.commands,
      );

      expect(downloadGitHubDatabaseFromUrlMock).toHaveBeenCalledTimes(1);
      expect(downloadGitHubDatabaseFromUrlMock).toHaveBeenCalledWith(
        updates[1].database.url,
        updates[1].database.id,
        updates[1].database.created_at,
        updates[1].database.commit_oid,
        owner,
        repo,
        octokit,
        expect.anything(),
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
        databaseFetcher,
        app.commands,
      );

      expect(downloadGitHubDatabaseFromUrlMock).toHaveBeenCalledTimes(2);
      expect(downloadGitHubDatabaseFromUrlMock).toHaveBeenCalledWith(
        updates[0].database.url,
        updates[0].database.id,
        updates[0].database.created_at,
        updates[0].database.commit_oid,
        owner,
        repo,
        octokit,
        expect.anything(),
        false,
        false,
      );
      expect(downloadGitHubDatabaseFromUrlMock).toHaveBeenCalledWith(
        updates[1].database.url,
        updates[1].database.id,
        updates[1].database.created_at,
        updates[1].database.commit_oid,
        owner,
        repo,
        octokit,
        expect.anything(),
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
          databaseFetcher,
          app.commands,
        );

        expect(downloadGitHubDatabaseFromUrlMock).not.toHaveBeenCalled();
      });
    });
  });
});
