import { CodeQLCliServer } from "../../../src/cli";
import {
  QUERY_LANGUAGE_TO_DATABASE_REPO,
  SkeletonQueryWizard,
} from "../../../src/skeleton-query-wizard";
import { mockedObject, mockedQuickPickItem } from "../utils/mocking.helpers";
import * as tmp from "tmp";
import { TextDocument, window, workspace, WorkspaceFolder } from "vscode";
import { extLogger } from "../../../src/common";
import { QlPackGenerator } from "../../../src/qlpack-generator";
import * as helpers from "../../../src/helpers";
import { createFileSync, ensureDirSync, removeSync } from "fs-extra";
import { join } from "path";
import { CancellationTokenSource } from "vscode-jsonrpc";
import { testCredentialsWithStub } from "../../factories/authentication";
import {
  DatabaseItem,
  DatabaseManager,
  FullDatabaseOptions,
} from "../../../src/local-databases";
import * as databaseFetcher from "../../../src/databaseFetcher";
import { createMockDB } from "../../factories/databases/databases";
import { asError } from "../../../src/pure/helpers-pure";

describe("SkeletonQueryWizard", () => {
  let mockCli: CodeQLCliServer;
  let wizard: SkeletonQueryWizard;
  let mockDatabaseManager: DatabaseManager;
  let dir: tmp.DirResult;
  let storagePath: string;
  let quickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let generateSpy: jest.SpiedFunction<
    typeof QlPackGenerator.prototype.generate
  >;
  let createExampleQlFileSpy: jest.SpiedFunction<
    typeof QlPackGenerator.prototype.createExampleQlFile
  >;
  let downloadGitHubDatabaseSpy: jest.SpiedFunction<
    typeof databaseFetcher.downloadGitHubDatabase
  >;
  let askForGitHubRepoSpy: jest.SpiedFunction<
    typeof databaseFetcher.askForGitHubRepo
  >;
  let openTextDocumentSpy: jest.SpiedFunction<
    typeof workspace.openTextDocument
  >;

  const token = new CancellationTokenSource().token;
  const credentials = testCredentialsWithStub();
  const chosenLanguage = "ruby";

  jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

  beforeEach(async () => {
    mockCli = mockedObject<CodeQLCliServer>({
      resolveLanguages: jest
        .fn()
        .mockResolvedValue([
          "ruby",
          "javascript",
          "go",
          "java",
          "python",
          "csharp",
          "cpp",
        ]),
      getSupportedLanguages: jest.fn(),
    });

    mockDatabaseManager = mockedObject<DatabaseManager>({
      setCurrentDatabaseItem: jest.fn(),
      databaseItems: [] as DatabaseItem[],
    });

    dir = tmp.dirSync({
      prefix: "skeleton_query_wizard_",
      unsafeCleanup: true,
    });

    storagePath = dir.name;

    jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue([
      {
        name: `codespaces-codeql`,
        uri: { fsPath: storagePath },
      },
      {
        name: "/second/folder/path",
        uri: { fsPath: storagePath },
      },
    ] as WorkspaceFolder[]);

    quickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockResolvedValueOnce(mockedQuickPickItem(chosenLanguage));
    generateSpy = jest
      .spyOn(QlPackGenerator.prototype, "generate")
      .mockResolvedValue(undefined);
    createExampleQlFileSpy = jest
      .spyOn(QlPackGenerator.prototype, "createExampleQlFile")
      .mockResolvedValue(undefined);
    downloadGitHubDatabaseSpy = jest
      .spyOn(databaseFetcher, "downloadGitHubDatabase")
      .mockResolvedValue(undefined);
    openTextDocumentSpy = jest
      .spyOn(workspace, "openTextDocument")
      .mockResolvedValue({} as TextDocument);

    wizard = new SkeletonQueryWizard(
      mockCli,
      jest.fn(),
      credentials,
      extLogger,
      mockDatabaseManager,
      token,
      storagePath,
    );

    askForGitHubRepoSpy = jest
      .spyOn(databaseFetcher, "askForGitHubRepo")
      .mockResolvedValue(QUERY_LANGUAGE_TO_DATABASE_REPO[chosenLanguage]);
  });

  afterEach(async () => {
    dir.removeCallback();
  });

  it("should prompt for language", async () => {
    await wizard.execute();

    expect(mockCli.getSupportedLanguages).toHaveBeenCalled();
    expect(quickPickSpy).toHaveBeenCalled();
  });

  describe("if QL pack doesn't exist", () => {
    beforeEach(() => {
      jest.spyOn(helpers, "isFolderAlreadyInWorkspace").mockReturnValue(false);
    });
    it("should try to create a new QL pack based on the language", async () => {
      await wizard.execute();

      expect(generateSpy).toHaveBeenCalled();
    });

    it("should download database for selected language", async () => {
      await wizard.execute();

      expect(downloadGitHubDatabaseSpy).toHaveBeenCalled();
    });

    it("should open the query file", async () => {
      await wizard.execute();

      expect(openTextDocumentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringMatching("example.ql"),
        }),
      );
    });
  });

  describe("if QL pack exists", () => {
    beforeEach(async () => {
      jest.spyOn(helpers, "isFolderAlreadyInWorkspace").mockReturnValue(true);

      // create a skeleton codeql-custom-queries-${language} folder
      // with an example QL file inside
      ensureDirSync(
        join(dir.name, `codeql-custom-queries-${chosenLanguage}`, "example.ql"),
      );
    });

    it("should create new query file in the same QL pack folder", async () => {
      await wizard.execute();

      expect(createExampleQlFileSpy).toHaveBeenCalledWith("example2.ql");
    });

    it("should only take into account example QL files", async () => {
      createFileSync(
        join(dir.name, `codeql-custom-queries-${chosenLanguage}`, "MyQuery.ql"),
      );

      await wizard.execute();

      expect(createExampleQlFileSpy).toHaveBeenCalledWith("example2.ql");
    });

    describe("if QL pack has no query file", () => {
      it("should create new query file in the same QL pack folder", async () => {
        removeSync(
          join(
            dir.name,
            `codeql-custom-queries-${chosenLanguage}`,
            "example.ql",
          ),
        );
        await wizard.execute();

        expect(createExampleQlFileSpy).toHaveBeenCalledWith("example1.ql");
      });

      it("should open the query file", async () => {
        removeSync(
          join(
            dir.name,
            `codeql-custom-queries-${chosenLanguage}`,
            "example.ql",
          ),
        );

        await wizard.execute();

        expect(openTextDocumentSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringMatching("example1.ql"),
          }),
        );
      });
    });

    describe("if database is also already downloaded", () => {
      let databaseNwo: string;
      let databaseItem: DatabaseItem;
      let mockDatabaseManagerWithItems: DatabaseManager;

      beforeEach(async () => {
        databaseNwo = QUERY_LANGUAGE_TO_DATABASE_REPO[chosenLanguage];

        databaseItem = {
          name: databaseNwo,
          language: chosenLanguage,
        } as DatabaseItem;

        mockDatabaseManagerWithItems = mockedObject<DatabaseManager>({
          setCurrentDatabaseItem: jest.fn(),
          databaseItems: [databaseItem] as DatabaseItem[],
        });

        wizard = new SkeletonQueryWizard(
          mockCli,
          jest.fn(),
          credentials,
          extLogger,
          mockDatabaseManagerWithItems,
          token,
          storagePath,
        );
      });

      it("should not download a new database for language", async () => {
        await wizard.execute();

        expect(downloadGitHubDatabaseSpy).not.toHaveBeenCalled();
      });

      it("should select an existing database", async () => {
        await wizard.execute();

        expect(
          mockDatabaseManagerWithItems.setCurrentDatabaseItem,
        ).toHaveBeenCalledWith(databaseItem);
      });

      it("should open the new query file", async () => {
        await wizard.execute();

        expect(openTextDocumentSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringMatching("example2.ql"),
          }),
        );
      });
    });

    describe("if database is missing", () => {
      describe("if the user choses to downloaded the suggested database from GitHub", () => {
        it("should download a new database for language", async () => {
          await wizard.execute();

          expect(askForGitHubRepoSpy).toHaveBeenCalled();
          expect(downloadGitHubDatabaseSpy).toHaveBeenCalled();
        });
      });

      describe("if the user choses to download a different database from GitHub than the one suggested", () => {
        beforeEach(() => {
          const chosenGitHubRepo = "pickles-owner/pickles-repo";

          askForGitHubRepoSpy = jest
            .spyOn(databaseFetcher, "askForGitHubRepo")
            .mockResolvedValue(chosenGitHubRepo);
        });

        it("should download the newly chosen database", async () => {
          await wizard.execute();

          expect(askForGitHubRepoSpy).toHaveBeenCalled();
          expect(downloadGitHubDatabaseSpy).toHaveBeenCalled();
        });
      });
    });
  });

  describe("getFirstStoragePath", () => {
    it("should return the first workspace folder", async () => {
      jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue([
        {
          name: "codespaces-codeql",
          uri: { fsPath: "codespaces-codeql" },
        },
      ] as WorkspaceFolder[]);

      wizard = new SkeletonQueryWizard(
        mockCli,
        jest.fn(),
        credentials,
        extLogger,
        mockDatabaseManager,
        token,
        storagePath,
      );

      expect(wizard.getFirstStoragePath()).toEqual("codespaces-codeql");
    });

    describe("if user is in vscode-codeql-starter workspace", () => {
      it("should set storage path to parent folder", async () => {
        jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue([
          {
            name: "codeql-custom-queries-cpp",
            uri: {
              fsPath: join(
                "vscode-codeql-starter",
                "codeql-custom-queries-cpp",
              ),
            },
          },
          {
            name: "codeql-custom-queries-csharp",
            uri: {
              fsPath: join(
                "vscode-codeql-starter",
                "codeql-custom-queries-csharp",
              ),
            },
          },
        ] as WorkspaceFolder[]);

        wizard = new SkeletonQueryWizard(
          mockCli,
          jest.fn(),
          credentials,
          extLogger,
          mockDatabaseManager,
          token,
          storagePath,
        );

        expect(wizard.getFirstStoragePath()).toEqual("vscode-codeql-starter");
      });
    });
  });

  describe("findDatabaseItemByNwo", () => {
    describe("when the item exists", () => {
      it("should return the database item", async () => {
        const mockDbItem = createMockDB(dir, {
          language: "ruby",
          dateAdded: 123,
        } as FullDatabaseOptions);
        const mockDbItem2 = createMockDB(dir, {
          language: "javascript",
        } as FullDatabaseOptions);

        jest.spyOn(mockDbItem, "name", "get").mockReturnValue("mock-name");

        const databaseItem = await wizard.findDatabaseItemByNwo(
          mockDbItem.language,
          mockDbItem.name,
          [mockDbItem, mockDbItem2],
        );

        expect(JSON.stringify(databaseItem)).toEqual(
          JSON.stringify(mockDbItem),
        );
      });

      it("should ignore databases with errors", async () => {
        const mockDbItem = createMockDB(dir, {
          language: "ruby",
          dateAdded: 123,
        } as FullDatabaseOptions);
        const mockDbItem2 = createMockDB(dir, {
          language: "javascript",
        } as FullDatabaseOptions);
        const mockDbItem3 = createMockDB(dir, {
          language: "ruby",
          dateAdded: 345,
        } as FullDatabaseOptions);

        jest.spyOn(mockDbItem, "name", "get").mockReturnValue("mock-name");
        jest.spyOn(mockDbItem3, "name", "get").mockReturnValue(mockDbItem.name);

        jest
          .spyOn(mockDbItem, "error", "get")
          .mockReturnValue(asError("database go boom!"));

        const databaseItem = await wizard.findDatabaseItemByNwo(
          mockDbItem.language,
          mockDbItem.name,
          [mockDbItem, mockDbItem2, mockDbItem3],
        );

        expect(JSON.stringify(databaseItem)).toEqual(
          JSON.stringify(mockDbItem3),
        );
      });
    });

    describe("when the item doesn't exist", () => {
      it("should return nothing", async () => {
        const mockDbItem = createMockDB(dir);
        const mockDbItem2 = createMockDB(dir);

        const databaseItem = await wizard.findDatabaseItemByNwo(
          "ruby",
          "mock-nwo",
          [mockDbItem, mockDbItem2],
        );

        expect(databaseItem).toBeUndefined();
      });
    });
  });

  describe("findDatabaseItemByLanguage", () => {
    describe("when the item exists", () => {
      it("should return the database item", async () => {
        const mockDbItem = createMockDB(dir, {
          language: "ruby",
        } as FullDatabaseOptions);
        const mockDbItem2 = createMockDB(dir, {
          language: "javascript",
        } as FullDatabaseOptions);

        const databaseItem = await wizard.findDatabaseItemByLanguage("ruby", [
          mockDbItem,
          mockDbItem2,
        ]);

        expect(databaseItem).toEqual(mockDbItem);
      });

      it("should ignore databases with errors", async () => {
        const mockDbItem = createMockDB(dir, {
          language: "ruby",
        } as FullDatabaseOptions);
        const mockDbItem2 = createMockDB(dir, {
          language: "javascript",
        } as FullDatabaseOptions);
        const mockDbItem3 = createMockDB(dir, {
          language: "ruby",
        } as FullDatabaseOptions);

        jest
          .spyOn(mockDbItem, "error", "get")
          .mockReturnValue(asError("database go boom!"));

        const databaseItem = await wizard.findDatabaseItemByLanguage("ruby", [
          mockDbItem,
          mockDbItem2,
          mockDbItem3,
        ]);

        expect(JSON.stringify(databaseItem)).toEqual(
          JSON.stringify(mockDbItem3),
        );
      });
    });

    describe("when the item doesn't exist", () => {
      it("should return nothing", async () => {
        const mockDbItem = createMockDB(dir);
        const mockDbItem2 = createMockDB(dir);

        const databaseItem = await wizard.findDatabaseItemByLanguage("ruby", [
          mockDbItem,
          mockDbItem2,
        ]);

        expect(databaseItem).toBeUndefined();
      });
    });
  });
});
