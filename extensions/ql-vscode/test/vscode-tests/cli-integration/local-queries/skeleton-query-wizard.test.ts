import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import {
  QUERY_LANGUAGE_TO_DATABASE_REPO,
  SkeletonQueryWizard,
} from "../../../../src/local-queries/skeleton-query-wizard";
import { mockedObject, mockedQuickPickItem } from "../../utils/mocking.helpers";
import * as tmp from "tmp";
import { TextDocument, window, workspace, WorkspaceFolder } from "vscode";
import { extLogger } from "../../../../src/common/logging/vscode";
import { QlPackGenerator } from "../../../../src/local-queries/qlpack-generator";
import {
  createFileSync,
  ensureDir,
  ensureDirSync,
  ensureFile,
  removeSync,
} from "fs-extra";
import { dirname, join } from "path";
import { testCredentialsWithStub } from "../../../factories/authentication";
import {
  DatabaseItem,
  DatabaseManager,
  FullDatabaseOptions,
} from "../../../../src/databases/local-databases";
import * as databaseFetcher from "../../../../src/databases/database-fetcher";
import { createMockDB } from "../../../factories/databases/databases";
import { asError } from "../../../../src/common/helpers-pure";
import { Setting } from "../../../../src/config";
import { QueryLanguage } from "../../../../src/common/query-language";
import {
  createQueryTreeFileItem,
  createQueryTreeFolderItem,
  QueryTreeViewItem,
} from "../../../../src/queries-panel/query-tree-view-item";

describe("SkeletonQueryWizard", () => {
  let mockCli: CodeQLCliServer;
  let wizard: SkeletonQueryWizard;
  let mockDatabaseManager: DatabaseManager;
  let dir: tmp.DirResult;
  let storagePath: string;
  let quickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let showInputBoxSpy: jest.SpiedFunction<typeof window.showInputBox>;
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

  const credentials = testCredentialsWithStub();
  const chosenLanguage = "ruby";
  const selectedItems: QueryTreeViewItem[] = [];

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
        uri: { fsPath: storagePath, scheme: "file" },
      },
      {
        name: "/second/folder/path",
        uri: { fsPath: storagePath, scheme: "file" },
      },
    ] as WorkspaceFolder[]);

    quickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockResolvedValueOnce(mockedQuickPickItem(chosenLanguage));
    showInputBoxSpy = jest
      .spyOn(window, "showInputBox")
      .mockResolvedValue(storagePath);
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
      storagePath,
      selectedItems,
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

  describe("with language", () => {
    beforeEach(() => {
      wizard = new SkeletonQueryWizard(
        mockCli,
        jest.fn(),
        credentials,
        extLogger,
        mockDatabaseManager,
        storagePath,
        selectedItems,
        QueryLanguage.Swift,
      );
    });

    it("should not prompt for language", async () => {
      await wizard.execute();

      expect(mockCli.getSupportedLanguages).not.toHaveBeenCalled();
      expect(quickPickSpy).not.toHaveBeenCalled();
    });
  });

  describe("if QL pack doesn't exist", () => {
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
          storagePath,
          selectedItems,
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

        const databaseItem = await SkeletonQueryWizard.findDatabaseItemByNwo(
          mockDbItem.language,
          mockDbItem.name,
          [mockDbItem, mockDbItem2],
        );

        expect(JSON.stringify(databaseItem)).toEqual(
          JSON.stringify(mockDbItem),
        );
      });
    });

    describe("when the item doesn't exist", () => {
      it("should return nothing", async () => {
        const mockDbItem = createMockDB(dir);
        const mockDbItem2 = createMockDB(dir);

        const databaseItem = await SkeletonQueryWizard.findDatabaseItemByNwo(
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

        const databaseItem =
          await SkeletonQueryWizard.findDatabaseItemByLanguage("ruby", [
            mockDbItem,
            mockDbItem2,
          ]);

        expect(databaseItem).toEqual(mockDbItem);
      });
    });

    describe("when the item doesn't exist", () => {
      it("should return nothing", async () => {
        const mockDbItem = createMockDB(dir);
        const mockDbItem2 = createMockDB(dir);

        const databaseItem =
          await SkeletonQueryWizard.findDatabaseItemByLanguage("ruby", [
            mockDbItem,
            mockDbItem2,
          ]);

        expect(databaseItem).toBeUndefined();
      });
    });
  });

  describe("determineStoragePath", () => {
    it("should prompt the user to provide a storage path when no items are selected", async () => {
      const chosenPath = await wizard.determineStoragePath();

      expect(showInputBoxSpy).toHaveBeenCalledWith(
        expect.objectContaining({ value: storagePath }),
      );
      expect(chosenPath).toEqual(storagePath);
    });

    describe("with folders and files", () => {
      let queriesDir: tmp.DirResult;

      beforeEach(async () => {
        queriesDir = tmp.dirSync({
          prefix: "queries_",
          unsafeCleanup: true,
        });

        await ensureDir(join(queriesDir.name, "folder"));
        await ensureFile(join(queriesDir.name, "queries-java", "example.ql"));
        await ensureFile(
          join(queriesDir.name, "codeql-custom-queries-swift", "example.ql"),
        );
      });

      describe("with selected folder", () => {
        let selectedItems: QueryTreeViewItem[];

        beforeEach(async () => {
          selectedItems = [
            createQueryTreeFolderItem(
              "folder",
              join(queriesDir.name, "folder"),
              [
                createQueryTreeFileItem(
                  "example.ql",
                  join(queriesDir.name, "folder", "example.ql"),
                  "java",
                ),
              ],
            ),
          ];

          wizard = new SkeletonQueryWizard(
            mockCli,
            jest.fn(),
            credentials,
            extLogger,
            mockDatabaseManager,
            storagePath,
            selectedItems,
          );
        });

        it("returns the selected folder path", async () => {
          const chosenPath = await wizard.determineStoragePath();

          expect(chosenPath).toEqual(selectedItems[0].path);
        });
      });

      describe("with selected file", () => {
        let selectedItems: QueryTreeViewItem[];

        beforeEach(async () => {
          selectedItems = [
            createQueryTreeFileItem(
              "example.ql",
              join(queriesDir.name, "queries-java", "example.ql"),
              "java",
            ),
          ];

          wizard = new SkeletonQueryWizard(
            mockCli,
            jest.fn(),
            credentials,
            extLogger,
            mockDatabaseManager,
            storagePath,
            selectedItems,
          );
        });

        it("returns the selected file path", async () => {
          const chosenPath = await wizard.determineStoragePath();

          expect(chosenPath).toEqual(dirname(selectedItems[0].path));
        });
      });

      describe("with selected file with same name", () => {
        let selectedItems: QueryTreeViewItem[];

        beforeEach(async () => {
          selectedItems = [
            createQueryTreeFileItem(
              "example.ql",
              join(
                queriesDir.name,
                "codeql-custom-queries-swift",
                "example.ql",
              ),
              "java",
            ),
          ];

          wizard = new SkeletonQueryWizard(
            mockCli,
            jest.fn(),
            credentials,
            extLogger,
            mockDatabaseManager,
            storagePath,
            selectedItems,
            QueryLanguage.Swift,
          );
        });

        it("returns the parent path", async () => {
          const chosenPath = await wizard.determineStoragePath();

          expect(chosenPath).toEqual(queriesDir.name);
        });
      });

      describe("with multiple selected items", () => {
        let selectedItems: QueryTreeViewItem[];

        beforeEach(async () => {
          selectedItems = [
            createQueryTreeFileItem(
              "example.ql",
              join(queriesDir.name, "queries-java", "example.ql"),
              "java",
            ),
            createQueryTreeFolderItem(
              "folder",
              join(queriesDir.name, "folder"),
              [
                createQueryTreeFileItem(
                  "example.ql",
                  join(queriesDir.name, "folder", "example.ql"),
                  "java",
                ),
              ],
            ),
          ];

          wizard = new SkeletonQueryWizard(
            mockCli,
            jest.fn(),
            credentials,
            extLogger,
            mockDatabaseManager,
            storagePath,
            selectedItems,
          );
        });

        it("returns the first selected item path", async () => {
          const chosenPath = await wizard.determineStoragePath();

          expect(chosenPath).toEqual(dirname(selectedItems[0].path));
        });
      });
    });
  });

  describe("determineRootStoragePath", () => {
    it("should prompt the user to provide a storage path", async () => {
      const chosenPath = await wizard.determineRootStoragePath();

      expect(showInputBoxSpy).toHaveBeenCalledWith(
        expect.objectContaining({ value: storagePath }),
      );
      expect(chosenPath).toEqual(storagePath);
    });

    it("should write the chosen folder to settings", async () => {
      const updateValueSpy = jest.spyOn(Setting.prototype, "updateValue");

      await wizard.determineRootStoragePath();

      expect(updateValueSpy).toHaveBeenCalledWith(storagePath, 2);
    });

    describe("when the user is using the codespace template", () => {
      let originalValue: any;
      let storedPath: string;

      beforeEach(async () => {
        storedPath = join(dir.name, "pickles-folder");
        ensureDirSync(storedPath);

        originalValue = workspace
          .getConfiguration("codeQL.createQuery")
          .get("qlPackLocation");

        // Set isCodespacesTemplate to true to indicate we are in the codespace template
        await workspace
          .getConfiguration("codeQL")
          .update("codespacesTemplate", true);
      });

      afterEach(async () => {
        await workspace
          .getConfiguration("codeQL.createQuery")
          .update("qlPackLocation", originalValue);

        await workspace
          .getConfiguration("codeQL")
          .update("codespacesTemplate", false);
      });

      it("should not prompt the user", async () => {
        const chosenPath = await wizard.determineRootStoragePath();

        expect(showInputBoxSpy).not.toHaveBeenCalled();
        expect(chosenPath).toEqual(storagePath);
      });
    });

    describe("when there is already a saved storage path in settings", () => {
      describe("when the saved storage path exists", () => {
        let originalValue: any;
        let storedPath: string;

        beforeEach(async () => {
          storedPath = join(dir.name, "pickles-folder");
          ensureDirSync(storedPath);

          originalValue = workspace
            .getConfiguration("codeQL.createQuery")
            .get("qlPackLocation");
          await workspace
            .getConfiguration("codeQL.createQuery")
            .update("qlPackLocation", storedPath);
        });

        afterEach(async () => {
          await workspace
            .getConfiguration("codeQL.createQuery")
            .update("qlPackLocation", originalValue);
        });

        it("should return it and not prompt the user", async () => {
          const chosenPath = await wizard.determineRootStoragePath();

          expect(showInputBoxSpy).not.toHaveBeenCalled();
          expect(chosenPath).toEqual(storedPath);
        });
      });

      describe("when the saved storage path does not exist", () => {
        let originalValue: any;
        let storedPath: string;

        beforeEach(async () => {
          storedPath = join(dir.name, "this-folder-does-not-exist");

          originalValue = workspace
            .getConfiguration("codeQL.createQuery")
            .get("qlPackLocation");
          await workspace
            .getConfiguration("codeQL.createQuery")
            .update("qlPackLocation", storedPath);
        });

        afterEach(async () => {
          await workspace
            .getConfiguration("codeQL.createQuery")
            .update("qlPackLocation", originalValue);
        });

        it("should prompt the user for to provide a new folder name", async () => {
          const chosenPath = await wizard.determineRootStoragePath();

          expect(showInputBoxSpy).toHaveBeenCalled();
          expect(chosenPath).toEqual(storagePath);
        });
      });
    });
  });

  describe("sortDatabaseItemsByDateAdded", () => {
    describe("should return a sorted list", () => {
      it("should sort the items by dateAdded", async () => {
        const mockDbItem = createMockDB(dir, {
          dateAdded: 678,
        } as FullDatabaseOptions);
        const mockDbItem2 = createMockDB(dir, {
          dateAdded: 123,
        } as FullDatabaseOptions);
        const mockDbItem3 = createMockDB(dir, {
          dateAdded: undefined,
        } as FullDatabaseOptions);
        const mockDbItem4 = createMockDB(dir, {
          dateAdded: 345,
        } as FullDatabaseOptions);

        const sortedList =
          await SkeletonQueryWizard.sortDatabaseItemsByDateAdded([
            mockDbItem,
            mockDbItem2,
            mockDbItem3,
            mockDbItem4,
          ]);

        expect(sortedList).toEqual([
          mockDbItem3,
          mockDbItem2,
          mockDbItem4,
          mockDbItem,
        ]);
      });

      it("should ignore databases with errors", async () => {
        const mockDbItem = createMockDB(dir, {
          dateAdded: 678,
        } as FullDatabaseOptions);
        const mockDbItem2 = createMockDB(dir, {
          dateAdded: undefined,
        } as FullDatabaseOptions);
        const mockDbItem3 = createMockDB(dir, {
          dateAdded: 345,
        } as FullDatabaseOptions);
        const mockDbItem4 = createMockDB(dir, {
          dateAdded: 123,
        } as FullDatabaseOptions);

        mockDbItem.error = asError("database go boom!");

        const sortedList =
          await SkeletonQueryWizard.sortDatabaseItemsByDateAdded([
            mockDbItem,
            mockDbItem2,
            mockDbItem3,
            mockDbItem4,
          ]);

        expect(sortedList).toEqual([mockDbItem2, mockDbItem4, mockDbItem3]);
      });
    });
  });

  describe("findExistingDatabaseItem", () => {
    describe("when there are multiple items with the same name", () => {
      it("should choose the latest one", async () => {
        const mockDbItem = createMockDB(dir, {
          language: "javascript",
          dateAdded: 456,
        } as FullDatabaseOptions);
        const mockDbItem2 = createMockDB(dir, {
          language: "ruby",
          dateAdded: 789,
        } as FullDatabaseOptions);
        const mockDbItem3 = createMockDB(dir, {
          language: "javascript",
          dateAdded: 123,
        } as FullDatabaseOptions);
        const mockDbItem4 = createMockDB(dir, {
          language: "javascript",
          dateAdded: undefined,
        } as FullDatabaseOptions);

        jest
          .spyOn(mockDbItem, "name", "get")
          .mockReturnValue(QUERY_LANGUAGE_TO_DATABASE_REPO["javascript"]);
        jest
          .spyOn(mockDbItem2, "name", "get")
          .mockReturnValue(QUERY_LANGUAGE_TO_DATABASE_REPO["javascript"]);

        const databaseItem = await SkeletonQueryWizard.findExistingDatabaseItem(
          "javascript",
          [mockDbItem, mockDbItem2, mockDbItem3, mockDbItem4],
        );

        expect(JSON.stringify(databaseItem)).toEqual(
          JSON.stringify(mockDbItem),
        );
      });
    });

    describe("when there are multiple items with the same language", () => {
      it("should choose the latest one", async () => {
        const mockDbItem = createMockDB(dir, {
          language: "ruby",
          dateAdded: 789,
        } as FullDatabaseOptions);
        const mockDbItem2 = createMockDB(dir, {
          language: "javascript",
          dateAdded: 456,
        } as FullDatabaseOptions);
        const mockDbItem3 = createMockDB(dir, {
          language: "ruby",
          dateAdded: 123,
        } as FullDatabaseOptions);
        const mockDbItem4 = createMockDB(dir, {
          language: "javascript",
          dateAdded: undefined,
        } as FullDatabaseOptions);

        const databaseItem = await SkeletonQueryWizard.findExistingDatabaseItem(
          "javascript",
          [mockDbItem, mockDbItem2, mockDbItem3, mockDbItem4],
        );

        expect(JSON.stringify(databaseItem)).toEqual(
          JSON.stringify(mockDbItem2),
        );
      });
    });
  });
});
