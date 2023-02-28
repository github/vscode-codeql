import * as fs from "fs-extra";
import { Uri, WorkspaceFolder } from "vscode";

import { QLTestAdapter } from "../../../src/test-adapter";
import { CodeQLCliServer } from "../../../src/cli";
import {
  DatabaseItem,
  DatabaseItemImpl,
  DatabaseManager,
  FullDatabaseOptions,
} from "../../../src/local-databases";
import { mockedObject } from "../utils/mocking.helpers";

jest.mock("fs-extra", () => {
  const original = jest.requireActual("fs-extra");
  return {
    ...original,
    access: jest.fn(),
  };
});

const mockedFsExtra = jest.mocked(fs);

describe("test-adapter", () => {
  let adapter: QLTestAdapter;
  let fakeDatabaseManager: DatabaseManager;
  let currentDatabaseItem: DatabaseItem | undefined;
  let databaseItems: DatabaseItem[] = [];
  const openDatabaseSpy = jest.fn();
  const removeDatabaseItemSpy = jest.fn();
  const renameDatabaseItemSpy = jest.fn();
  const setCurrentDatabaseItemSpy = jest.fn();
  const runTestsSpy = jest.fn();
  const resolveTestsSpy = jest.fn();
  const resolveQlpacksSpy = jest.fn();

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
    mockRunTests();
    openDatabaseSpy.mockResolvedValue(postTestDatabaseItem);
    removeDatabaseItemSpy.mockResolvedValue(undefined);
    renameDatabaseItemSpy.mockResolvedValue(undefined);
    setCurrentDatabaseItemSpy.mockResolvedValue(undefined);
    resolveQlpacksSpy.mockResolvedValue({});
    resolveTestsSpy.mockResolvedValue([]);
    fakeDatabaseManager = mockedObject<DatabaseManager>(
      {
        openDatabase: openDatabaseSpy,
        removeDatabaseItem: removeDatabaseItemSpy,
        renameDatabaseItem: renameDatabaseItemSpy,
        setCurrentDatabaseItem: setCurrentDatabaseItemSpy,
      },
      {
        dynamicProperties: {
          currentDatabaseItem: () => currentDatabaseItem,
          databaseItems: () => databaseItems,
        },
      },
    );

    jest.spyOn(preTestDatabaseItem, "isAffectedByTest").mockResolvedValue(true);

    adapter = new QLTestAdapter(
      mockedObject<WorkspaceFolder>({
        name: "ABC",
        uri: Uri.parse("file:/ab/c"),
      }),
      mockedObject<CodeQLCliServer>({
        runTests: runTestsSpy,
        resolveQlpacks: resolveQlpacksSpy,
        resolveTests: resolveTestsSpy,
      }),
      fakeDatabaseManager,
    );
  });

  it("should run some tests", async () => {
    const listenerSpy = jest.fn();
    adapter.testStates(listenerSpy);
    const testsPath = Uri.parse("file:/ab/c").fsPath;
    const dPath = Uri.parse("file:/ab/c/d.ql").fsPath;
    const gPath = Uri.parse("file:/ab/c/e/f/g.ql").fsPath;
    const hPath = Uri.parse("file:/ab/c/e/f/h.ql").fsPath;

    await adapter.run([testsPath]);

    expect(listenerSpy).toBeCalledTimes(5);

    expect(listenerSpy).toHaveBeenNthCalledWith(1, {
      type: "started",
      tests: [testsPath],
    });
    expect(listenerSpy).toHaveBeenNthCalledWith(2, {
      type: "test",
      state: "passed",
      test: dPath,
      message: undefined,
      decorations: [],
    });
    expect(listenerSpy).toHaveBeenNthCalledWith(3, {
      type: "test",
      state: "errored",
      test: gPath,
      message: `\ncompilation error: ${gPath}\nERROR: abc\n`,
      decorations: [{ line: 1, message: "abc" }],
    });
    expect(listenerSpy).toHaveBeenNthCalledWith(4, {
      type: "test",
      state: "failed",
      test: hPath,
      message: `\nfailed: ${hPath}\njkh\ntuv\n`,
      decorations: [],
    });
    expect(listenerSpy).toHaveBeenNthCalledWith(5, { type: "finished" });
  });

  it("should reregister testproj databases around test run", async () => {
    mockedFsExtra.access.mockResolvedValue(undefined);

    currentDatabaseItem = preTestDatabaseItem;
    databaseItems = [preTestDatabaseItem];
    await adapter.run(["/path/to/test/dir"]);

    expect(removeDatabaseItemSpy.mock.invocationCallOrder[0]).toBeLessThan(
      runTestsSpy.mock.invocationCallOrder[0],
    );
    expect(openDatabaseSpy.mock.invocationCallOrder[0]).toBeGreaterThan(
      runTestsSpy.mock.invocationCallOrder[0],
    );
    expect(renameDatabaseItemSpy.mock.invocationCallOrder[0]).toBeGreaterThan(
      openDatabaseSpy.mock.invocationCallOrder[0],
    );
    expect(
      setCurrentDatabaseItemSpy.mock.invocationCallOrder[0],
    ).toBeGreaterThan(openDatabaseSpy.mock.invocationCallOrder[0]);

    expect(removeDatabaseItemSpy).toBeCalledTimes(1);
    expect(removeDatabaseItemSpy).toBeCalledWith(
      expect.anything(),
      expect.anything(),
      preTestDatabaseItem,
    );

    expect(openDatabaseSpy).toBeCalledTimes(1);
    expect(openDatabaseSpy).toBeCalledWith(
      expect.anything(),
      expect.anything(),
      preTestDatabaseItem.databaseUri,
    );

    expect(renameDatabaseItemSpy).toBeCalledTimes(1);
    expect(renameDatabaseItemSpy).toBeCalledWith(
      postTestDatabaseItem,
      preTestDatabaseItem.name,
    );

    expect(setCurrentDatabaseItemSpy).toBeCalledTimes(1);
    expect(setCurrentDatabaseItemSpy).toBeCalledWith(
      postTestDatabaseItem,
      true,
    );
  });

  function mockRunTests() {
    // runTests is an async generator function. This is not directly supported in sinon
    // However, we can pretend the same thing by just returning an async array.
    runTestsSpy.mockReturnValue(
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
