import * as tmp from "tmp";
import * as fs from "fs-extra";
import { join } from "path";
import { ExtensionContext, Uri, workspace } from "vscode";

import {
  DatabaseContentsWithDbScheme,
  DatabaseEventKind,
  DatabaseItemImpl,
  DatabaseManager,
  DatabaseResolver,
  FullDatabaseOptions,
} from "../../../../src/databases/local-databases";
import { Logger } from "../../../../src/common/logging";
import { CodeQLCliServer, DbInfo } from "../../../../src/codeql-cli/cli";
import {
  encodeArchiveBasePath,
  encodeSourceArchiveUri,
} from "../../../../src/common/vscode/archive-filesystem-provider";
import { testDisposeHandler } from "../../test-dispose-handler";
import { QueryRunner } from "../../../../src/query-server/query-runner";
import * as dialog from "../../../../src/common/vscode/dialog";
import { Setting } from "../../../../src/config";
import { QlPackGenerator } from "../../../../src/local-queries/qlpack-generator";
import { mockedObject } from "../../utils/mocking.helpers";
import { createMockApp } from "../../../__mocks__/appMock";
import {
  createMockDB,
  dbLocationUri,
  mockDbOptions,
  sourceLocationUri,
} from "../../../factories/databases/databases";
import { findSourceArchive } from "../../../../src/databases/local-databases/database-resolver";
import { LanguageContextStore } from "../../../../src/language-context-store";

describe("local databases", () => {
  let databaseManager: DatabaseManager;
  let extensionContext: ExtensionContext;

  let updateSpy: jest.Mock<Promise<void>, []>;
  let registerSpy: jest.Mock<Promise<void>, []>;
  let deregisterSpy: jest.Mock<Promise<void>, []>;
  let resolveDatabaseSpy: jest.Mock<Promise<DbInfo>, []>;
  let packAddSpy: jest.Mock<any, []>;
  let logSpy: jest.Mock<any, []>;

  let showNeverAskAgainDialogSpy: jest.SpiedFunction<
    typeof dialog.showNeverAskAgainDialog
  >;

  let dir: tmp.DirResult;
  let extensionContextStoragePath: string;

  beforeEach(() => {
    dir = tmp.dirSync();

    updateSpy = jest.fn(() => Promise.resolve(undefined));
    registerSpy = jest.fn(() => Promise.resolve(undefined));
    deregisterSpy = jest.fn(() => Promise.resolve(undefined));
    resolveDatabaseSpy = jest.fn(() => Promise.resolve({} as DbInfo));
    packAddSpy = jest.fn();
    logSpy = jest.fn(() => {
      /* */
    });

    showNeverAskAgainDialogSpy = jest
      .spyOn(dialog, "showNeverAskAgainDialog")
      .mockResolvedValue("Yes");

    extensionContextStoragePath = dir.name;

    extensionContext = mockedObject<ExtensionContext>(
      {
        workspaceState: {
          update: updateSpy,
          get: () => [],
        },
      },
      {
        dynamicProperties: {
          // pretend like databases added in the temp dir are controlled by the extension
          // so that they are deleted upon removal
          storageUri: () => Uri.file(extensionContextStoragePath),
        },
      },
    );

    const mockApp = createMockApp({});
    databaseManager = new DatabaseManager(
      extensionContext,
      mockApp,
      mockedObject<QueryRunner>({
        registerDatabase: registerSpy,
        deregisterDatabase: deregisterSpy,
        onStart: () => {
          /**/
        },
      }),
      mockedObject<CodeQLCliServer>({
        resolveDatabase: resolveDatabaseSpy,
        packAdd: packAddSpy,
      }),
      new LanguageContextStore(mockApp),
      mockedObject<Logger>({
        log: logSpy,
      }),
    );

    // Unfortunately, during a test it is not possible to convert from
    // a single root workspace to multi-root, so must stub out relevant
    // functions
    jest.spyOn(workspace, "updateWorkspaceFolders").mockReturnValue(true);
  });

  afterEach(async () => {
    dir.removeCallback();
    databaseManager.dispose(testDisposeHandler);
  });

  it("should fire events when adding and removing a db item", async () => {
    const mockDbItem = createMockDB(dir);
    const onDidChangeDatabaseItem = jest.fn();
    databaseManager.onDidChangeDatabaseItem(onDidChangeDatabaseItem);
    await (databaseManager as any).addDatabaseItem(mockDbItem);

    expect((databaseManager as any)._databaseItems).toEqual([mockDbItem]);
    expect(updateSpy).toBeCalledWith("databaseList", [
      {
        options: mockDbOptions(),
        uri: dbLocationUri(dir).toString(true),
      },
    ]);
    expect(onDidChangeDatabaseItem).toBeCalledWith({
      item: undefined,
      kind: DatabaseEventKind.Add,
    });

    updateSpy.mockClear();
    onDidChangeDatabaseItem.mockClear();

    // now remove the item
    await databaseManager.removeDatabaseItem(mockDbItem);
    expect((databaseManager as any)._databaseItems).toEqual([]);
    expect(updateSpy).toBeCalledWith("databaseList", []);
    expect(onDidChangeDatabaseItem).toBeCalledWith({
      item: undefined,
      kind: DatabaseEventKind.Remove,
    });
  });

  describe("renameDatabaseItem", () => {
    it("should rename a db item and emit an event", async () => {
      const mockDbItem = createMockDB(dir);
      const onDidChangeDatabaseItem = jest.fn();
      databaseManager.onDidChangeDatabaseItem(onDidChangeDatabaseItem);
      await (databaseManager as any).addDatabaseItem(mockDbItem);

      await databaseManager.renameDatabaseItem(mockDbItem, "new name");

      expect(mockDbItem.name).toBe("new name");
      expect(updateSpy).toBeCalledWith("databaseList", [
        {
          options: { ...mockDbOptions(), displayName: "new name" },
          uri: dbLocationUri(dir).toString(true),
        },
      ]);

      expect(onDidChangeDatabaseItem).toBeCalledWith({
        item: undefined,
        kind: DatabaseEventKind.Rename,
      });
    });
  });

  describe("add / remove database items", () => {
    it("should add a database item", async () => {
      const onDidChangeDatabaseItem = jest.fn();
      databaseManager.onDidChangeDatabaseItem(onDidChangeDatabaseItem);
      const mockDbItem = createMockDB(dir);

      await (databaseManager as any).addDatabaseItem(mockDbItem);

      expect(databaseManager.databaseItems).toEqual([mockDbItem]);
      expect(updateSpy).toBeCalledWith("databaseList", [
        {
          uri: dbLocationUri(dir).toString(true),
          options: mockDbOptions(),
        },
      ]);

      const mockEvent = {
        item: undefined,
        kind: DatabaseEventKind.Add,
      };
      expect(onDidChangeDatabaseItem).toBeCalledWith(mockEvent);
    });

    it("should add a database item source archive", async () => {
      const mockDbItem = createMockDB(dir);
      mockDbItem.name = "xxx";
      await databaseManager.addDatabaseSourceArchiveFolder(mockDbItem);

      // workspace folders should be updated. We can only check the mocks since
      // when running as a test, we are not allowed to update the workspace folders
      expect(workspace.updateWorkspaceFolders).toHaveBeenCalledWith(1, 0, {
        name: "[xxx source archive]",
        // must use a matcher here since vscode URIs with the same path
        // are not always equal due to internal state.
        uri: expect.objectContaining({
          fsPath: encodeArchiveBasePath(sourceLocationUri(dir).fsPath).fsPath,
        }),
      });
    });

    it("should remove a database item", async () => {
      const mockDbItem = createMockDB(dir);
      await fs.ensureDir(mockDbItem.databaseUri.fsPath);

      // pretend that this item is the first workspace folder in the list
      jest
        .spyOn(mockDbItem, "belongsToSourceArchiveExplorerUri")
        .mockReturnValue(true);

      await (databaseManager as any).addDatabaseItem(mockDbItem);

      updateSpy.mockClear();

      await databaseManager.removeDatabaseItem(mockDbItem);

      expect(databaseManager.databaseItems).toEqual([]);
      expect(updateSpy).toBeCalledWith("databaseList", []);
      // should remove the folder
      expect(workspace.updateWorkspaceFolders).toBeCalledWith(0, 1);

      // should also delete the db contents
      await expect(fs.pathExists(mockDbItem.databaseUri.fsPath)).resolves.toBe(
        false,
      );
    });

    it("should remove a database item outside of the extension controlled area", async () => {
      const mockDbItem = createMockDB(dir);
      await fs.ensureDir(mockDbItem.databaseUri.fsPath);

      // pretend that this item is the first workspace folder in the list
      jest
        .spyOn(mockDbItem, "belongsToSourceArchiveExplorerUri")
        .mockReturnValue(true);
      await (databaseManager as any).addDatabaseItem(mockDbItem);
      updateSpy.mockClear();

      // pretend that the database location is not controlled by the extension
      (databaseManager as any).ctx.storageUri = Uri.file("hucairz");
      extensionContextStoragePath = "hucairz";

      await databaseManager.removeDatabaseItem(mockDbItem);

      expect(databaseManager.databaseItems).toEqual([]);
      expect(updateSpy).toBeCalledWith("databaseList", []);
      // should remove the folder
      expect(workspace.updateWorkspaceFolders).toBeCalledWith(0, 1);

      // should NOT delete the db contents
      await expect(fs.pathExists(mockDbItem.databaseUri.fsPath)).resolves.toBe(
        true,
      );
    });

    it("should register and deregister a database when adding and removing it", async () => {
      // similar test as above, but also check the call to sendRequestSpy to make sure they send the
      // registration messages.
      const mockDbItem = createMockDB(dir);

      await (databaseManager as any).addDatabaseItem(mockDbItem);
      // Should have registered this database
      expect(registerSpy).toBeCalledWith(mockDbItem);

      await databaseManager.removeDatabaseItem(mockDbItem);

      // Should have deregistered this database
      expect(deregisterSpy).toBeCalledWith(mockDbItem);
    });
  });

  describe("resolveSourceFile", () => {
    it("should fail to resolve when not a uri", () => {
      const db = createMockDB(
        dir,
        mockDbOptions(),
        Uri.parse("file:/sourceArchive-uri/"),
      );
      (db as any).contents.sourceArchiveUri = undefined;
      expect(() => db.resolveSourceFile("abc")).toThrowError(
        "Scheme is missing",
      );
    });

    it("should fail to resolve when not a file uri", () => {
      const db = createMockDB(
        dir,
        mockDbOptions(),
        Uri.parse("file:/sourceArchive-uri/"),
      );
      (db as any).contents.sourceArchiveUri = undefined;
      expect(() => db.resolveSourceFile("http://abc")).toThrowError(
        "Invalid uri scheme",
      );
    });

    describe("no source archive", () => {
      it("should resolve undefined", () => {
        const db = createMockDB(
          dir,
          mockDbOptions(),
          Uri.parse("file:/sourceArchive-uri/"),
        );
        (db as any).contents.sourceArchiveUri = undefined;
        const resolved = db.resolveSourceFile(undefined);
        expect(resolved.toString(true)).toBe(dbLocationUri(dir).toString(true));
      });

      it("should resolve an empty file", () => {
        const db = createMockDB(
          dir,
          mockDbOptions(),
          Uri.parse("file:/sourceArchive-uri/"),
        );
        (db as any).contents.sourceArchiveUri = undefined;
        const resolved = db.resolveSourceFile("file:");
        expect(resolved.toString()).toBe("file:///");
      });
    });

    describe("zipped source archive", () => {
      it("should encode a source archive url", () => {
        const db = createMockDB(
          dir,
          mockDbOptions(),
          encodeSourceArchiveUri({
            sourceArchiveZipPath: "sourceArchive-uri",
            pathWithinSourceArchive: "def",
          }),
        );
        const resolved = db.resolveSourceFile(Uri.file("abc").toString());

        // must recreate an encoded archive uri instead of typing out the
        // text since the uris will be different on windows and ubuntu.
        expect(resolved.toString()).toBe(
          encodeSourceArchiveUri({
            sourceArchiveZipPath: "sourceArchive-uri",
            pathWithinSourceArchive: "def/abc",
          }).toString(),
        );
      });

      it("should encode a source archive url with trailing slash", () => {
        const db = createMockDB(
          dir,
          mockDbOptions(),
          encodeSourceArchiveUri({
            sourceArchiveZipPath: "sourceArchive-uri",
            pathWithinSourceArchive: "def/",
          }),
        );
        const resolved = db.resolveSourceFile(Uri.file("abc").toString());

        // must recreate an encoded archive uri instead of typing out the
        // text since the uris will be different on windows and ubuntu.
        expect(resolved.toString()).toBe(
          encodeSourceArchiveUri({
            sourceArchiveZipPath: "sourceArchive-uri",
            pathWithinSourceArchive: "def/abc",
          }).toString(),
        );
      });

      it("should encode an empty source archive url", () => {
        const db = createMockDB(
          dir,
          mockDbOptions(),
          encodeSourceArchiveUri({
            sourceArchiveZipPath: "sourceArchive-uri",
            pathWithinSourceArchive: "def",
          }),
        );
        const resolved = db.resolveSourceFile("file:");
        expect(resolved.toString()).toBe(
          "codeql-zip-archive://1-18/sourceArchive-uri/def/",
        );
      });
    });

    it("should handle an empty file", () => {
      const db = createMockDB(
        dir,
        mockDbOptions(),
        Uri.parse("file:/sourceArchive-uri/"),
      );
      const resolved = db.resolveSourceFile("");
      expect(resolved.toString()).toBe("file:///sourceArchive-uri/");
    });
  });

  describe("getPrimaryLanguage", () => {
    it("should get the primary language", async () => {
      resolveDatabaseSpy.mockResolvedValue({
        languages: ["python"],
      } as unknown as DbInfo);
      const result = await (databaseManager as any).getPrimaryLanguage(
        "hucairz",
      );
      expect(result).toBe("python");
    });

    it("should handle missing the primary language", async () => {
      resolveDatabaseSpy.mockResolvedValue({
        languages: [],
      } as unknown as DbInfo);
      const result = await (databaseManager as any).getPrimaryLanguage(
        "hucairz",
      );
      expect(result).toBe("");
    });
  });

  describe("isAffectedByTest", () => {
    let directoryPath: string;
    let projectPath: string;
    let qlFilePath: string;

    beforeEach(async () => {
      directoryPath = join(dir.name, "dir");
      await fs.ensureDir(directoryPath);
      projectPath = join(directoryPath, "dir.testproj");
      await fs.writeFile(projectPath, "");
      qlFilePath = join(directoryPath, "test.ql");
      await fs.writeFile(qlFilePath, "");
    });

    it("should return true for testproj database in test directory", async () => {
      const db = createMockDB(
        dir,
        mockDbOptions(),
        sourceLocationUri(dir),
        Uri.file(projectPath),
      );
      expect(await db.isAffectedByTest(directoryPath)).toBe(true);
    });

    it("should return false for non-existent test directory", async () => {
      const db = createMockDB(
        dir,
        mockDbOptions(),
        sourceLocationUri(dir),
        Uri.file(join(dir.name, "non-existent/non-existent.testproj")),
      );
      expect(await db.isAffectedByTest(join(dir.name, "non-existent"))).toBe(
        false,
      );
    });

    it("should return false for non-testproj database in test directory", async () => {
      const anotherProjectPath = join(directoryPath, "dir.proj");
      await fs.writeFile(anotherProjectPath, "");

      const db = createMockDB(
        dir,
        mockDbOptions(),
        sourceLocationUri(dir),
        Uri.file(anotherProjectPath),
      );
      expect(await db.isAffectedByTest(directoryPath)).toBe(false);
    });

    it("should return false for testproj database outside test directory", async () => {
      const anotherProjectDir = join(dir.name, "other");
      await fs.ensureDir(anotherProjectDir);
      const anotherProjectPath = join(anotherProjectDir, "other.testproj");
      await fs.writeFile(anotherProjectPath, "");

      const db = createMockDB(
        dir,
        mockDbOptions(),
        sourceLocationUri(dir),
        Uri.file(anotherProjectPath),
      );
      expect(await db.isAffectedByTest(directoryPath)).toBe(false);
    });

    it("should return false for testproj database for prefix directory", async () => {
      const db = createMockDB(
        dir,
        mockDbOptions(),
        sourceLocationUri(dir),
        Uri.file(projectPath),
      );
      // /d is a prefix of /dir/dir.testproj, but
      // /dir/dir.testproj is not under /d
      expect(await db.isAffectedByTest(join(directoryPath, "d"))).toBe(false);
    });

    it("should return true for testproj database for test file", async () => {
      const db = createMockDB(
        dir,
        mockDbOptions(),
        sourceLocationUri(dir),
        Uri.file(projectPath),
      );
      expect(await db.isAffectedByTest(qlFilePath)).toBe(true);
    });

    it("should return false for non-existent test file", async () => {
      const otherTestFile = join(directoryPath, "other-test.ql");
      const db = createMockDB(
        dir,
        mockDbOptions(),
        sourceLocationUri(dir),
        Uri.file(projectPath),
      );
      expect(await db.isAffectedByTest(otherTestFile)).toBe(false);
    });

    it("should return false for non-testproj database for test file", async () => {
      const anotherProjectPath = join(directoryPath, "dir.proj");
      await fs.writeFile(anotherProjectPath, "");

      const db = createMockDB(
        dir,
        mockDbOptions(),
        sourceLocationUri(dir),
        Uri.file(anotherProjectPath),
      );
      expect(await db.isAffectedByTest(qlFilePath)).toBe(false);
    });

    it("should return false for testproj database not matching test file", async () => {
      const otherTestFile = join(dir.name, "test.ql");
      await fs.writeFile(otherTestFile, "");

      const db = createMockDB(
        dir,
        mockDbOptions(),
        sourceLocationUri(dir),
        Uri.file(projectPath),
      );
      expect(await db.isAffectedByTest(otherTestFile)).toBe(false);
    });
  });

  describe("findSourceArchive", () => {
    ["src", "output/src_archive"].forEach((name) => {
      it(`should find source folder in ${name}`, async () => {
        const uri = Uri.file(join(dir.name, name));
        fs.createFileSync(join(uri.fsPath, "hucairz.txt"));
        const srcUri = await findSourceArchive(dir.name);
        expect(srcUri!.fsPath).toBe(uri.fsPath);
      });

      it(`should find source archive in ${name}.zip`, async () => {
        const uri = Uri.file(join(dir.name, `${name}.zip`));
        fs.createFileSync(uri.fsPath);
        const srcUri = await findSourceArchive(dir.name);
        expect(srcUri!.fsPath).toBe(uri.fsPath);
      });

      it(`should prioritize ${name}.zip over ${name}`, async () => {
        const uri = Uri.file(join(dir.name, `${name}.zip`));
        fs.createFileSync(uri.fsPath);

        const uriFolder = Uri.file(join(dir.name, name));
        fs.createFileSync(join(uriFolder.fsPath, "hucairz.txt"));

        const srcUri = await findSourceArchive(dir.name);
        expect(srcUri!.fsPath).toBe(uri.fsPath);
      });
    });

    it("should prioritize src over output/src_archive", async () => {
      const uriSrc = Uri.file(join(dir.name, "src.zip"));
      fs.createFileSync(uriSrc.fsPath);
      const uriSrcArchive = Uri.file(join(dir.name, "src.zip"));
      fs.createFileSync(uriSrcArchive.fsPath);

      const resultUri = await findSourceArchive(dir.name);
      expect(resultUri!.fsPath).toBe(uriSrc.fsPath);
    });
  });

  describe("createSkeletonPacks", () => {
    let mockDbItem: DatabaseItemImpl;
    let language: string;
    let generateSpy: jest.SpyInstance;

    beforeEach(() => {
      language = "ruby";

      const options: FullDatabaseOptions = {
        dateAdded: 123,
        language,
      };
      mockDbItem = createMockDB(dir, options);

      generateSpy = jest
        .spyOn(QlPackGenerator.prototype, "generate")
        .mockImplementation(() => Promise.resolve());
    });

    describe("when the language is set", () => {
      it("should offer the user to set up a skeleton QL pack", async () => {
        await (databaseManager as any).createSkeletonPacks(mockDbItem);

        expect(showNeverAskAgainDialogSpy).toBeCalledTimes(1);
      });

      it("should return early if the user refuses help", async () => {
        showNeverAskAgainDialogSpy = jest
          .spyOn(dialog, "showNeverAskAgainDialog")
          .mockResolvedValue("No");

        await (databaseManager as any).createSkeletonPacks(mockDbItem);

        expect(generateSpy).not.toBeCalled();
      });

      it("should return early and write choice to settings if user wants to never be asked again", async () => {
        showNeverAskAgainDialogSpy = jest
          .spyOn(dialog, "showNeverAskAgainDialog")
          .mockResolvedValue("No, and never ask me again");
        const updateValueSpy = jest.spyOn(Setting.prototype, "updateValue");

        await (databaseManager as any).createSkeletonPacks(mockDbItem);

        expect(generateSpy).not.toBeCalled();
        expect(updateValueSpy).toHaveBeenCalledWith("never", 2);
      });

      it("should create the skeleton QL pack for the user", async () => {
        await (databaseManager as any).createSkeletonPacks(mockDbItem);

        expect(generateSpy).toBeCalled();
      });
    });

    describe("when the language is not set", () => {
      it("should fail gracefully", async () => {
        mockDbItem = createMockDB(dir);
        await (databaseManager as any).createSkeletonPacks(mockDbItem);
        expect(logSpy).toHaveBeenCalledWith(
          "Could not create skeleton QL pack because the selected database's language is not set.",
        );
      });
    });

    describe("when the databaseItem is not set", () => {
      it("should fail gracefully", async () => {
        await (databaseManager as any).createSkeletonPacks(undefined);
        expect(logSpy).toHaveBeenCalledWith(
          "Could not create QL pack because no database is selected. Please add a database.",
        );
      });
    });

    describe("when the QL pack already exists", () => {
      beforeEach(() => {
        fs.mkdirSync(join(dir.name, `codeql-custom-queries-${language}`));
      });

      it("should exit early", async () => {
        showNeverAskAgainDialogSpy = jest
          .spyOn(dialog, "showNeverAskAgainDialog")
          .mockResolvedValue("No");

        await (databaseManager as any).createSkeletonPacks(mockDbItem);

        expect(generateSpy).not.toBeCalled();
      });
    });
  });

  describe("openDatabase", () => {
    let createSkeletonPacksSpy: jest.SpyInstance;
    let resolveDatabaseContentsSpy: jest.SpyInstance;
    let setCurrentDatabaseItemSpy: jest.SpyInstance;
    let addDatabaseSourceArchiveFolderSpy: jest.SpyInstance;
    let mockDbItem: DatabaseItemImpl;

    beforeEach(() => {
      createSkeletonPacksSpy = jest
        .spyOn(databaseManager, "createSkeletonPacks")
        .mockImplementation(async () => {
          /* no-op */
        });

      resolveDatabaseContentsSpy = jest
        .spyOn(DatabaseResolver, "resolveDatabaseContents")
        .mockResolvedValue({} as DatabaseContentsWithDbScheme);

      setCurrentDatabaseItemSpy = jest.spyOn(
        databaseManager,
        "setCurrentDatabaseItem",
      );

      addDatabaseSourceArchiveFolderSpy = jest.spyOn(
        databaseManager,
        "addDatabaseSourceArchiveFolder",
      );

      jest.mock("fs", () => ({
        promises: {
          pathExists: jest.fn().mockResolvedValue(true),
        },
      }));

      mockDbItem = createMockDB(dir);
    });

    it("should resolve the database contents", async () => {
      await databaseManager.openDatabase(mockDbItem.databaseUri);

      expect(resolveDatabaseContentsSpy).toBeCalledTimes(2);
    });

    it("should set the database as the currently selected one", async () => {
      await databaseManager.openDatabase(mockDbItem.databaseUri);

      expect(setCurrentDatabaseItemSpy).toBeCalledTimes(1);
    });

    it("should add database source archive folder", async () => {
      await databaseManager.openDatabase(mockDbItem.databaseUri);

      expect(addDatabaseSourceArchiveFolderSpy).toBeCalledTimes(1);
    });

    describe("when codeQL.codespacesTemplate is set to true", () => {
      describe("when we add the tutorial database to the codespace", () => {
        it("should not offer to create a skeleton QL pack", async () => {
          jest.spyOn(Setting.prototype, "getValue").mockReturnValue(true);

          const isTutorialDatabase = true;
          const makeSelected = true;
          const nameOverride = "CodeQL Tutorial Database";

          await databaseManager.openDatabase(
            mockDbItem.databaseUri,
            makeSelected,
            nameOverride,
            { isTutorialDatabase },
          );

          expect(createSkeletonPacksSpy).toBeCalledTimes(0);
        });
      });

      describe("when we add a new database that isn't the tutorial one", () => {
        it("should create a skeleton QL pack", async () => {
          jest.spyOn(Setting.prototype, "getValue").mockReturnValue(true);

          await databaseManager.openDatabase(mockDbItem.databaseUri);

          expect(createSkeletonPacksSpy).toBeCalledTimes(1);
        });
      });
    });

    describe("when codeQL.codespacesTemplate is set to false", () => {
      it("should not create a skeleton QL pack", async () => {
        jest.spyOn(Setting.prototype, "getValue").mockReturnValue(false);

        await databaseManager.openDatabase(mockDbItem.databaseUri);
        expect(createSkeletonPacksSpy).toBeCalledTimes(0);
      });
    });

    describe("when codeQL.codespacesTemplate is not set", () => {
      it("should not create a skeleton QL pack", async () => {
        jest.spyOn(Setting.prototype, "getValue").mockReturnValue(undefined);

        await databaseManager.openDatabase(mockDbItem.databaseUri);
        expect(createSkeletonPacksSpy).toBeCalledTimes(0);
      });
    });
  });
});
