import * as sinon from "sinon";
import * as tmp from "tmp";
import * as fs from "fs-extra";
import * as path from "path";
import { expect } from "chai";
import { CancellationToken, ExtensionContext, Uri, workspace } from "vscode";

import {
  DatabaseEventKind,
  DatabaseManager,
  DatabaseItemImpl,
  DatabaseContents,
  FullDatabaseOptions,
  findSourceArchive,
} from "../../databases";
import { Logger } from "../../logging";
import { ProgressCallback } from "../../commandRunner";
import { CodeQLCliServer } from "../../cli";
import {
  encodeArchiveBasePath,
  encodeSourceArchiveUri,
} from "../../archive-filesystem-provider";
import { testDisposeHandler } from "../test-dispose-handler";
import { QueryRunner } from "../../queryRunner";

describe("databases", () => {
  const MOCK_DB_OPTIONS: FullDatabaseOptions = {
    dateAdded: 123,
    ignoreSourceArchive: false,
    language: "",
  };

  let databaseManager: DatabaseManager;
  let updateSpy: sinon.SinonSpy;
  let getSpy: sinon.SinonStub;
  let dbChangedHandler: sinon.SinonSpy;
  let registerSpy: sinon.SinonSpy;
  let deregisterSpy: sinon.SinonSpy;
  let supportsDatabaseRegistrationSpy: sinon.SinonStub;
  let supportsLanguageNameSpy: sinon.SinonStub;
  let resolveDatabaseSpy: sinon.SinonStub;

  let sandbox: sinon.SinonSandbox;
  let dir: tmp.DirResult;

  beforeEach(() => {
    dir = tmp.dirSync();

    sandbox = sinon.createSandbox();
    updateSpy = sandbox.spy();
    getSpy = sandbox.stub();
    getSpy.returns([]);
    registerSpy = sandbox.stub();
    deregisterSpy = sandbox.stub();
    dbChangedHandler = sandbox.spy();
    supportsDatabaseRegistrationSpy = sandbox.stub();
    supportsDatabaseRegistrationSpy.resolves(true);
    supportsLanguageNameSpy = sandbox.stub();
    resolveDatabaseSpy = sandbox.stub();
    databaseManager = new DatabaseManager(
      {
        workspaceState: {
          update: updateSpy,
          get: getSpy,
        },
        // pretend like databases added in the temp dir are controlled by the extension
        // so that they are deleted upon removal
        storagePath: dir.name,
      } as unknown as ExtensionContext,
      {
        registerDatabase: registerSpy,
        deregisterDatabase: deregisterSpy,
        onStart: () => {
          /**/
        },
      } as unknown as QueryRunner,
      {
        cliConstraints: {
          supportsLanguageName: supportsLanguageNameSpy,
          supportsDatabaseRegistration: supportsDatabaseRegistrationSpy,
        },
        resolveDatabase: resolveDatabaseSpy,
      } as unknown as CodeQLCliServer,
      {
        log: () => {
          /**/
        },
      } as unknown as Logger,
    );

    // Unfortunately, during a test it is not possible to convert from
    // a single root workspace to multi-root, so must stub out relevant
    // functions
    sandbox.stub(workspace, "updateWorkspaceFolders");
    sandbox.spy(workspace, "onDidChangeWorkspaceFolders");
  });

  afterEach(async () => {
    dir.removeCallback();
    databaseManager.dispose(testDisposeHandler);
    sandbox.restore();
  });

  it("should fire events when adding and removing a db item", async () => {
    const mockDbItem = createMockDB();
    const spy = sinon.spy();
    databaseManager.onDidChangeDatabaseItem(spy);
    await (databaseManager as any).addDatabaseItem(
      {} as ProgressCallback,
      {} as CancellationToken,
      mockDbItem,
    );

    expect((databaseManager as any)._databaseItems).to.deep.eq([mockDbItem]);
    expect(updateSpy).to.have.been.calledWith("databaseList", [
      {
        options: MOCK_DB_OPTIONS,
        uri: dbLocationUri().toString(true),
      },
    ]);
    expect(spy).to.have.been.calledWith({
      item: undefined,
      kind: DatabaseEventKind.Add,
    });

    sinon.reset();

    // now remove the item
    await databaseManager.removeDatabaseItem(
      {} as ProgressCallback,
      {} as CancellationToken,
      mockDbItem,
    );
    expect((databaseManager as any)._databaseItems).to.deep.eq([]);
    expect(updateSpy).to.have.been.calledWith("databaseList", []);
    expect(spy).to.have.been.calledWith({
      item: undefined,
      kind: DatabaseEventKind.Remove,
    });
  });

  it("should rename a db item and emit an event", async () => {
    const mockDbItem = createMockDB();
    const spy = sinon.spy();
    databaseManager.onDidChangeDatabaseItem(spy);
    await (databaseManager as any).addDatabaseItem(
      {} as ProgressCallback,
      {} as CancellationToken,
      mockDbItem,
    );

    sinon.restore();

    await databaseManager.renameDatabaseItem(mockDbItem, "new name");

    expect(mockDbItem.name).to.eq("new name");
    expect(updateSpy).to.have.been.calledWith("databaseList", [
      {
        options: { ...MOCK_DB_OPTIONS, displayName: "new name" },
        uri: dbLocationUri().toString(true),
      },
    ]);

    expect(spy).to.have.been.calledWith({
      item: undefined,
      kind: DatabaseEventKind.Rename,
    });
  });

  describe("add / remove database items", () => {
    it("should add a database item", async () => {
      const spy = sandbox.spy();
      databaseManager.onDidChangeDatabaseItem(spy);
      const mockDbItem = createMockDB();

      await (databaseManager as any).addDatabaseItem(
        {} as ProgressCallback,
        {} as CancellationToken,
        mockDbItem,
      );

      expect(databaseManager.databaseItems).to.deep.eq([mockDbItem]);
      expect(updateSpy).to.have.been.calledWith("databaseList", [
        {
          uri: dbLocationUri().toString(true),
          options: MOCK_DB_OPTIONS,
        },
      ]);

      const mockEvent = {
        item: undefined,
        kind: DatabaseEventKind.Add,
      };
      expect(spy).to.have.been.calledWith(mockEvent);
    });

    it("should add a database item source archive", async function () {
      const mockDbItem = createMockDB();
      mockDbItem.name = "xxx";
      await (databaseManager as any).addDatabaseSourceArchiveFolder(mockDbItem);

      // workspace folders should be updated. We can only check the mocks since
      // when running as a test, we are not allowed to update the workspace folders
      expect(workspace.updateWorkspaceFolders).to.have.been.calledWith(1, 0, {
        name: "[xxx source archive]",
        // must use a matcher here since vscode URIs with the same path
        // are not always equal due to internal state.
        uri: sinon.match.has(
          "fsPath",
          encodeArchiveBasePath(sourceLocationUri().fsPath).fsPath,
        ),
      });
    });

    it("should remove a database item", async () => {
      const mockDbItem = createMockDB();
      sandbox.stub(fs, "remove").resolves();

      // pretend that this item is the first workspace folder in the list
      sandbox
        .stub(mockDbItem, "belongsToSourceArchiveExplorerUri")
        .returns(true);

      await (databaseManager as any).addDatabaseItem(
        {} as ProgressCallback,
        {} as CancellationToken,
        mockDbItem,
      );

      updateSpy.resetHistory();

      await databaseManager.removeDatabaseItem(
        {} as ProgressCallback,
        {} as CancellationToken,
        mockDbItem,
      );

      expect(databaseManager.databaseItems).to.deep.eq([]);
      expect(updateSpy).to.have.been.calledWith("databaseList", []);
      // should remove the folder
      expect(workspace.updateWorkspaceFolders).to.have.been.calledWith(0, 1);

      // should also delete the db contents
      expect(fs.remove).to.have.been.calledWith(mockDbItem.databaseUri.fsPath);
    });

    it("should remove a database item outside of the extension controlled area", async () => {
      const mockDbItem = createMockDB();
      sandbox.stub(fs, "remove").resolves();

      // pretend that this item is the first workspace folder in the list
      sandbox
        .stub(mockDbItem, "belongsToSourceArchiveExplorerUri")
        .returns(true);

      await (databaseManager as any).addDatabaseItem(
        {} as ProgressCallback,
        {} as CancellationToken,
        mockDbItem,
      );
      updateSpy.resetHistory();

      // pretend that the database location is not controlled by the extension
      (databaseManager as any).ctx.storagePath = "hucairz";

      await databaseManager.removeDatabaseItem(
        {} as ProgressCallback,
        {} as CancellationToken,
        mockDbItem,
      );

      expect(databaseManager.databaseItems).to.deep.eq([]);
      expect(updateSpy).to.have.been.calledWith("databaseList", []);
      // should remove the folder
      expect(workspace.updateWorkspaceFolders).to.have.been.calledWith(0, 1);

      // should NOT delete the db contents
      expect(fs.remove).not.to.have.been.called;
    });

    it("should register and deregister a database when adding and removing it", async () => {
      // similar test as above, but also check the call to sendRequestSpy to make sure they send the
      // registration messages.
      const mockDbItem = createMockDB();

      sandbox.stub(fs, "remove").resolves();

      await (databaseManager as any).addDatabaseItem(
        {} as ProgressCallback,
        {} as CancellationToken,
        mockDbItem,
      );
      // Should have registered this database
      expect(registerSpy).to.have.been.calledWith({}, {}, mockDbItem);

      await databaseManager.removeDatabaseItem(
        {} as ProgressCallback,
        {} as CancellationToken,
        mockDbItem,
      );

      // Should have deregistered this database
      expect(deregisterSpy).to.have.been.calledWith({}, {}, mockDbItem);
    });
  });

  describe("resolveSourceFile", () => {
    it("should fail to resolve when not a uri", () => {
      const db = createMockDB(Uri.parse("file:/sourceArchive-uri/"));
      (db as any)._contents.sourceArchiveUri = undefined;
      expect(() => db.resolveSourceFile("abc")).to.throw("Scheme is missing");
    });

    it("should fail to resolve when not a file uri", () => {
      const db = createMockDB(Uri.parse("file:/sourceArchive-uri/"));
      (db as any)._contents.sourceArchiveUri = undefined;
      expect(() => db.resolveSourceFile("http://abc")).to.throw(
        "Invalid uri scheme",
      );
    });

    describe("no source archive", () => {
      it("should resolve undefined", () => {
        const db = createMockDB(Uri.parse("file:/sourceArchive-uri/"));
        (db as any)._contents.sourceArchiveUri = undefined;
        const resolved = db.resolveSourceFile(undefined);
        expect(resolved.toString(true)).to.eq(dbLocationUri().toString(true));
      });

      it("should resolve an empty file", () => {
        const db = createMockDB(Uri.parse("file:/sourceArchive-uri/"));
        (db as any)._contents.sourceArchiveUri = undefined;
        const resolved = db.resolveSourceFile("file:");
        expect(resolved.toString()).to.eq("file:///");
      });
    });

    describe("zipped source archive", () => {
      it("should encode a source archive url", () => {
        const db = createMockDB(
          encodeSourceArchiveUri({
            sourceArchiveZipPath: "sourceArchive-uri",
            pathWithinSourceArchive: "def",
          }),
        );
        const resolved = db.resolveSourceFile(Uri.file("abc").toString());

        // must recreate an encoded archive uri instead of typing out the
        // text since the uris will be different on windows and ubuntu.
        expect(resolved.toString()).to.eq(
          encodeSourceArchiveUri({
            sourceArchiveZipPath: "sourceArchive-uri",
            pathWithinSourceArchive: "def/abc",
          }).toString(),
        );
      });

      it("should encode a source archive url with trailing slash", () => {
        const db = createMockDB(
          encodeSourceArchiveUri({
            sourceArchiveZipPath: "sourceArchive-uri",
            pathWithinSourceArchive: "def/",
          }),
        );
        const resolved = db.resolveSourceFile(Uri.file("abc").toString());

        // must recreate an encoded archive uri instead of typing out the
        // text since the uris will be different on windows and ubuntu.
        expect(resolved.toString()).to.eq(
          encodeSourceArchiveUri({
            sourceArchiveZipPath: "sourceArchive-uri",
            pathWithinSourceArchive: "def/abc",
          }).toString(),
        );
      });

      it("should encode an empty source archive url", () => {
        const db = createMockDB(
          encodeSourceArchiveUri({
            sourceArchiveZipPath: "sourceArchive-uri",
            pathWithinSourceArchive: "def",
          }),
        );
        const resolved = db.resolveSourceFile("file:");
        expect(resolved.toString()).to.eq(
          "codeql-zip-archive://1-18/sourceArchive-uri/def/",
        );
      });
    });

    it("should handle an empty file", () => {
      const db = createMockDB(Uri.parse("file:/sourceArchive-uri/"));
      const resolved = db.resolveSourceFile("");
      expect(resolved.toString()).to.eq("file:///sourceArchive-uri/");
    });
  });

  it("should not support the primary language", async () => {
    supportsLanguageNameSpy.resolves(false);

    const result = await (databaseManager as any).getPrimaryLanguage("hucairz");
    expect(result).to.be.undefined;
  });

  it("should get the primary language", async () => {
    supportsLanguageNameSpy.resolves(true);
    resolveDatabaseSpy.resolves({
      languages: ["python"],
    });
    const result = await (databaseManager as any).getPrimaryLanguage("hucairz");
    expect(result).to.eq("python");
  });

  it("should handle missing the primary language", async () => {
    supportsLanguageNameSpy.resolves(true);
    resolveDatabaseSpy.resolves({
      languages: [],
    });
    const result = await (databaseManager as any).getPrimaryLanguage("hucairz");
    expect(result).to.eq("");
  });

  describe("isAffectedByTest", () => {
    const directoryStats = new fs.Stats();
    const fileStats = new fs.Stats();

    before(() => {
      sinon.stub(directoryStats, "isDirectory").returns(true);
      sinon.stub(fileStats, "isDirectory").returns(false);
    });

    it("should return true for testproj database in test directory", async () => {
      sandbox.stub(fs, "stat").resolves(directoryStats);
      const db = createMockDB(
        sourceLocationUri(),
        Uri.file("/path/to/dir/dir.testproj"),
      );
      expect(await db.isAffectedByTest("/path/to/dir")).to.true;
    });

    it("should return false for non-existent test directory", async () => {
      sandbox.stub(fs, "stat").throws("Simulated Error: ENOENT");
      const db = createMockDB(
        sourceLocationUri(),
        Uri.file("/path/to/dir/dir.testproj"),
      );
      expect(await db.isAffectedByTest("/path/to/dir")).to.false;
    });

    it("should return false for non-testproj database in test directory", async () => {
      sandbox.stub(fs, "stat").resolves(directoryStats);
      const db = createMockDB(
        sourceLocationUri(),
        Uri.file("/path/to/dir/dir.proj"),
      );
      expect(await db.isAffectedByTest("/path/to/dir")).to.false;
    });

    it("should return false for testproj database outside test directory", async () => {
      sandbox.stub(fs, "stat").resolves(directoryStats);
      const db = createMockDB(
        sourceLocationUri(),
        Uri.file("/path/to/other/dir.testproj"),
      );
      expect(await db.isAffectedByTest("/path/to/dir")).to.false;
    });

    it("should return false for testproj database for prefix directory", async () => {
      sandbox.stub(fs, "stat").resolves(directoryStats);
      const db = createMockDB(
        sourceLocationUri(),
        Uri.file("/path/to/dir/dir.testproj"),
      );
      // /path/to/d is a prefix of /path/to/dir/dir.testproj, but
      // /path/to/dir/dir.testproj is not under /path/to/d
      expect(await db.isAffectedByTest("/path/to/d")).to.false;
    });

    it("should return true for testproj database for test file", async () => {
      sandbox.stub(fs, "stat").resolves(fileStats);
      const db = createMockDB(
        sourceLocationUri(),
        Uri.file("/path/to/dir/dir.testproj"),
      );
      expect(await db.isAffectedByTest("/path/to/dir/test.ql")).to.true;
    });

    it("should return false for non-existent test file", async () => {
      sandbox.stub(fs, "stat").throws("Simulated Error: ENOENT");
      const db = createMockDB(
        sourceLocationUri(),
        Uri.file("/path/to/dir/dir.testproj"),
      );
      expect(await db.isAffectedByTest("/path/to/dir/test.ql")).to.false;
    });

    it("should return false for non-testproj database for test file", async () => {
      sandbox.stub(fs, "stat").resolves(fileStats);
      const db = createMockDB(
        sourceLocationUri(),
        Uri.file("/path/to/dir/dir.proj"),
      );
      expect(await db.isAffectedByTest("/path/to/dir/test.ql")).to.false;
    });

    it("should return false for testproj database not matching test file", async () => {
      sandbox.stub(fs, "stat").resolves(fileStats);
      const db = createMockDB(
        sourceLocationUri(),
        Uri.file("/path/to/dir/dir.testproj"),
      );
      expect(await db.isAffectedByTest("/path/to/test.ql")).to.false;
    });
  });

  describe("findSourceArchive", function () {
    // not sure why, but some of these tests take more than two seconds to run.
    this.timeout(5000);

    ["src", "output/src_archive"].forEach((name) => {
      it(`should find source folder in ${name}`, async () => {
        const uri = Uri.file(path.join(dir.name, name));
        fs.createFileSync(path.join(uri.fsPath, "hucairz.txt"));
        const srcUri = await findSourceArchive(dir.name);
        expect(srcUri!.fsPath).to.eq(uri.fsPath);
      });

      it(`should find source archive in ${name}.zip`, async () => {
        const uri = Uri.file(path.join(dir.name, name + ".zip"));
        fs.createFileSync(uri.fsPath);
        const srcUri = await findSourceArchive(dir.name);
        expect(srcUri!.fsPath).to.eq(uri.fsPath);
      });

      it(`should prioritize ${name}.zip over ${name}`, async () => {
        const uri = Uri.file(path.join(dir.name, name + ".zip"));
        fs.createFileSync(uri.fsPath);

        const uriFolder = Uri.file(path.join(dir.name, name));
        fs.createFileSync(path.join(uriFolder.fsPath, "hucairz.txt"));

        const srcUri = await findSourceArchive(dir.name);
        expect(srcUri!.fsPath).to.eq(uri.fsPath);
      });
    });

    it("should prioritize src over output/src_archive", async () => {
      const uriSrc = Uri.file(path.join(dir.name, "src.zip"));
      fs.createFileSync(uriSrc.fsPath);
      const uriSrcArchive = Uri.file(path.join(dir.name, "src.zip"));
      fs.createFileSync(uriSrcArchive.fsPath);

      const resultUri = await findSourceArchive(dir.name);
      expect(resultUri!.fsPath).to.eq(uriSrc.fsPath);
    });
  });

  function createMockDB(
    // source archive location must be a real(-ish) location since
    // tests will add this to the workspace location
    sourceArchiveUri = sourceLocationUri(),
    databaseUri = dbLocationUri(),
  ): DatabaseItemImpl {
    return new DatabaseItemImpl(
      databaseUri,
      {
        sourceArchiveUri,
        datasetUri: databaseUri,
      } as DatabaseContents,
      MOCK_DB_OPTIONS,
      dbChangedHandler,
    );
  }

  function sourceLocationUri() {
    return Uri.file(path.join(dir.name, "src.zip"));
  }

  function dbLocationUri() {
    return Uri.file(path.join(dir.name, "db"));
  }
});
