import {
  CancellationTokenSource,
  Range,
  TestItem,
  TestItemCollection,
  TestRun,
  TestRunRequest,
  Uri,
  WorkspaceFolder,
  tests,
} from "vscode";

import { QLTestAdapter } from "../../../src/test-adapter";
import { CodeQLCliServer } from "../../../src/cli";
import { DatabaseManager } from "../../../src/local-databases";
import { mockedObject } from "../utils/mocking.helpers";
import { TestRunner } from "../../../src/test-runner";
import {
  createMockCliServerForTestRun,
  mockEmptyDatabaseManager,
  mockTestsInfo,
} from "./test-runner-helpers";
import { TestManager } from "../../../src/test-manager";
import { createMockApp } from "../../__mocks__/appMock";

type IdTestItemPair = [id: string, testItem: TestItem];

describe("test-adapter", () => {
  let testRunner: TestRunner;
  let fakeDatabaseManager: DatabaseManager;
  let fakeCliServer: CodeQLCliServer;

  beforeEach(() => {
    fakeDatabaseManager = mockEmptyDatabaseManager();

    const mockCli = createMockCliServerForTestRun();
    fakeCliServer = mockCli.cliServer;

    testRunner = new TestRunner(fakeDatabaseManager, fakeCliServer);
  });

  it("legacy test adapter should run some tests", async () => {
    const adapter = new QLTestAdapter(
      mockedObject<WorkspaceFolder>({
        name: "ABC",
        uri: Uri.parse("file:/ab/c"),
      }),
      testRunner,
      fakeCliServer,
    );

    const listenerSpy = jest.fn();
    adapter.testStates(listenerSpy);
    await adapter.run([mockTestsInfo.testsPath]);

    expect(listenerSpy).toBeCalledTimes(5);

    expect(listenerSpy).toHaveBeenNthCalledWith(1, {
      type: "started",
      tests: [mockTestsInfo.testsPath],
    });
    expect(listenerSpy).toHaveBeenNthCalledWith(2, {
      type: "test",
      state: "passed",
      test: mockTestsInfo.dPath,
      message: undefined,
      decorations: [],
    });
    expect(listenerSpy).toHaveBeenNthCalledWith(3, {
      type: "test",
      state: "errored",
      test: mockTestsInfo.gPath,
      message: `\ncompilation error: ${mockTestsInfo.gPath}\nERROR: abc\n`,
      decorations: [{ line: 1, message: "abc" }],
    });
    expect(listenerSpy).toHaveBeenNthCalledWith(4, {
      type: "test",
      state: "failed",
      test: mockTestsInfo.hPath,
      message: `\nfailed: ${mockTestsInfo.hPath}\njkh\ntuv\n`,
      decorations: [],
    });
    expect(listenerSpy).toHaveBeenNthCalledWith(5, { type: "finished" });
  });

  it("native test manager should run some tests", async () => {
    const enqueuedSpy = jest.fn();
    const passedSpy = jest.fn();
    const erroredSpy = jest.fn();
    const failedSpy = jest.fn();
    const endSpy = jest.fn();

    const testController = tests.createTestController("codeql", "CodeQL Tests");
    testController.createTestRun = jest.fn().mockImplementation(() =>
      mockedObject<TestRun>({
        enqueued: enqueuedSpy,
        passed: passedSpy,
        errored: erroredSpy,
        failed: failedSpy,
        end: endSpy,
      }),
    );
    const testManager = new TestManager(
      createMockApp({}),
      testRunner,
      fakeCliServer,
      testController,
    );

    const childItems: TestItem[] = [
      {
        children: { size: 0 } as TestItemCollection,
        id: `test ${mockTestsInfo.dPath}`,
        uri: Uri.file(mockTestsInfo.dPath),
      } as TestItem,
      {
        children: { size: 0 } as TestItemCollection,
        id: `test ${mockTestsInfo.gPath}`,
        uri: Uri.file(mockTestsInfo.gPath),
      } as TestItem,
      {
        children: { size: 0 } as TestItemCollection,
        id: `test ${mockTestsInfo.hPath}`,
        uri: Uri.file(mockTestsInfo.hPath),
      } as TestItem,
    ];
    const childElements: IdTestItemPair[] = childItems.map((childItem) => [
      childItem.id,
      childItem,
    ]);
    const childIteratorFunc: () => Iterator<IdTestItemPair> = () =>
      childElements[Symbol.iterator]();

    const rootItem = {
      id: `dir ${mockTestsInfo.testsPath}`,
      uri: Uri.file(mockTestsInfo.testsPath),
      children: {
        size: 3,
        [Symbol.iterator]: childIteratorFunc,
      } as TestItemCollection,
    } as TestItem;

    const request = new TestRunRequest([rootItem]);
    await testManager.run(request, new CancellationTokenSource().token);

    expect(enqueuedSpy).toBeCalledTimes(3);
    expect(passedSpy).toBeCalledTimes(1);
    expect(passedSpy).toHaveBeenCalledWith(childItems[0], 3000);
    expect(erroredSpy).toHaveBeenCalledTimes(1);
    expect(erroredSpy).toHaveBeenCalledWith(
      childItems[1],
      [
        {
          location: {
            range: new Range(0, 0, 1, 1),
            uri: Uri.file(mockTestsInfo.gPath),
          },
          message: "abc",
        },
      ],
      4000,
    );
    expect(failedSpy).toHaveBeenCalledWith(
      childItems[2],
      [
        {
          message: "Test failed",
        },
      ],
      11000,
    );
    expect(failedSpy).toBeCalledTimes(1);
    expect(endSpy).toBeCalledTimes(1);
  });
});
