import * as sinon from "sinon";
import * as fs from "fs-extra";
import { Uri, WorkspaceFolder } from "vscode";
import { expect } from "chai";

import { QLTestAdapter } from "../../test-adapter";
import { CodeQLCliServer } from "../../cli";
import {
  DatabaseItem,
  DatabaseItemImpl,
  DatabaseManager,
  FullDatabaseOptions,
} from "../../databases";

describe("test-adapter", () => {
  let adapter: QLTestAdapter;
  let fakeDatabaseManager: DatabaseManager;
  let currentDatabaseItem: DatabaseItem | undefined;
  let databaseItems: DatabaseItem[] = [];
  let openDatabaseSpy: sinon.SinonStub;
  let removeDatabaseItemSpy: sinon.SinonStub;
  let renameDatabaseItemSpy: sinon.SinonStub;
  let setCurrentDatabaseItemSpy: sinon.SinonStub;
  let runTestsSpy: sinon.SinonStub;
  let resolveTestsSpy: sinon.SinonStub;
  let resolveQlpacksSpy: sinon.SinonStub;
  let sandox: sinon.SinonSandbox;

  const preTestDatabaseItem = new DatabaseItemImpl(
    Uri.file("/path/to/test/dir/dir.testproj"),
    undefined,
    { displayName: "custom display name" } as unknown as FullDatabaseOptions,
    (_) => {
      /* no change event listener */
    },
  );
  const postTestDatabaseItem = new DatabaseItemImpl(
    Uri.file("/path/to/test/dir/dir.testproj"),
    undefined,
    { displayName: "default name" } as unknown as FullDatabaseOptions,
    (_) => {
      /* no change event listener */
    },
  );

  beforeEach(() => {
    sandox = sinon.createSandbox();
    mockRunTests();
    openDatabaseSpy = sandox.stub().resolves(postTestDatabaseItem);
    removeDatabaseItemSpy = sandox.stub().resolves();
    renameDatabaseItemSpy = sandox.stub().resolves();
    setCurrentDatabaseItemSpy = sandox.stub().resolves();
    resolveQlpacksSpy = sandox.stub().resolves({});
    resolveTestsSpy = sandox.stub().resolves([]);
    fakeDatabaseManager = {
      currentDatabaseItem: undefined,
      databaseItems: undefined,
      openDatabase: openDatabaseSpy,
      removeDatabaseItem: removeDatabaseItemSpy,
      renameDatabaseItem: renameDatabaseItemSpy,
      setCurrentDatabaseItem: setCurrentDatabaseItemSpy,
    } as unknown as DatabaseManager;
    sandox
      .stub(fakeDatabaseManager, "currentDatabaseItem")
      .get(() => currentDatabaseItem);
    sandox.stub(fakeDatabaseManager, "databaseItems").get(() => databaseItems);
    sandox.stub(preTestDatabaseItem, "isAffectedByTest").resolves(true);
    adapter = new QLTestAdapter(
      {
        name: "ABC",
        uri: Uri.parse("file:/ab/c"),
      } as WorkspaceFolder,
      {
        runTests: runTestsSpy,
        resolveQlpacks: resolveQlpacksSpy,
        resolveTests: resolveTestsSpy,
      } as unknown as CodeQLCliServer,
      fakeDatabaseManager,
    );
  });

  afterEach(() => {
    sandox.restore();
  });

  it("should run some tests", async () => {
    const listenerSpy = sandox.spy();
    adapter.testStates(listenerSpy);
    const testsPath = Uri.parse("file:/ab/c").fsPath;
    const dPath = Uri.parse("file:/ab/c/d.ql").fsPath;
    const gPath = Uri.parse("file:/ab/c/e/f/g.ql").fsPath;
    const hPath = Uri.parse("file:/ab/c/e/f/h.ql").fsPath;

    await adapter.run([testsPath]);

    expect(listenerSpy.getCall(0).args).to.deep.eq([
      { type: "started", tests: [testsPath] },
    ]);
    expect(listenerSpy.getCall(1).args).to.deep.eq([
      {
        type: "test",
        state: "passed",
        test: dPath,
        message: undefined,
        decorations: [],
      },
    ]);
    expect(listenerSpy.getCall(2).args).to.deep.eq([
      {
        type: "test",
        state: "errored",
        test: gPath,
        message: `\ncompilation error: ${gPath}\nERROR: abc\n`,
        decorations: [{ line: 1, message: "abc" }],
      },
    ]);
    expect(listenerSpy.getCall(3).args).to.deep.eq([
      {
        type: "test",
        state: "failed",
        test: hPath,
        message: `\nfailed: ${hPath}\njkh\ntuv\n`,
        decorations: [],
      },
    ]);
    expect(listenerSpy.getCall(4).args).to.deep.eq([{ type: "finished" }]);
    expect(listenerSpy).to.have.callCount(5);
  });

  it("should reregister testproj databases around test run", async () => {
    sandox.stub(fs, "access").resolves();
    currentDatabaseItem = preTestDatabaseItem;
    databaseItems = [preTestDatabaseItem];
    await adapter.run(["/path/to/test/dir"]);

    removeDatabaseItemSpy.getCall(0).calledBefore(runTestsSpy.getCall(0));
    openDatabaseSpy.getCall(0).calledAfter(runTestsSpy.getCall(0));
    renameDatabaseItemSpy.getCall(0).calledAfter(openDatabaseSpy.getCall(0));
    setCurrentDatabaseItemSpy
      .getCall(0)
      .calledAfter(openDatabaseSpy.getCall(0));

    sinon.assert.calledOnceWithExactly(
      removeDatabaseItemSpy,
      sinon.match.any,
      sinon.match.any,
      preTestDatabaseItem,
    );
    sinon.assert.calledOnceWithExactly(
      openDatabaseSpy,
      sinon.match.any,
      sinon.match.any,
      preTestDatabaseItem.databaseUri,
    );
    sinon.assert.calledOnceWithExactly(
      renameDatabaseItemSpy,
      postTestDatabaseItem,
      preTestDatabaseItem.name,
    );
    sinon.assert.calledOnceWithExactly(
      setCurrentDatabaseItemSpy,
      postTestDatabaseItem,
      true,
    );
  });

  function mockRunTests() {
    // runTests is an async generator function. This is not directly supported in sinon
    // However, we can pretend the same thing by just returning an async array.
    runTestsSpy = sandox.stub();
    runTestsSpy.returns(
      (async function* () {
        yield Promise.resolve({
          test: Uri.parse("file:/ab/c/d.ql").fsPath,
          pass: true,
          messages: [],
        });
        yield Promise.resolve({
          test: Uri.parse("file:/ab/c/e/f/g.ql").fsPath,
          pass: false,
          diff: ["pqr", "xyz"],
          // a compile error
          failureStage: "COMPILATION",
          messages: [
            { position: { line: 1 }, message: "abc", severity: "ERROR" },
          ],
        });
        yield Promise.resolve({
          test: Uri.parse("file:/ab/c/e/f/h.ql").fsPath,
          pass: false,
          diff: ["jkh", "tuv"],
          failureStage: "RESULT",
          messages: [],
        });
      })(),
    );
  }
});
