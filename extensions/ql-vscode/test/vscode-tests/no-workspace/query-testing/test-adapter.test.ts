import type { TestItem, TestItemCollection, TestRun } from "vscode";
import {
  CancellationTokenSource,
  Location,
  Range,
  TestRunRequest,
  Uri,
  tests,
} from "vscode";

import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { DatabaseManager } from "../../../../src/databases/local-databases";
import { mockedObject } from "../../utils/mocking.helpers";
import { TestRunner } from "../../../../src/query-testing/test-runner";
import {
  createMockCliServerForTestRun,
  mockEmptyDatabaseManager,
  mockTestsInfo,
} from "./test-runner-helpers";
import { TestManager } from "../../../../src/query-testing/test-manager";
import { createMockApp } from "../../../__mocks__/appMock";

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
      {
        children: { size: 0 } as TestItemCollection,
        id: `test ${mockTestsInfo.kPath}`,
        uri: Uri.file(mockTestsInfo.kPath),
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
        size: 4,
        [Symbol.iterator]: childIteratorFunc,
      } as TestItemCollection,
    } as TestItem;

    const request = new TestRunRequest([rootItem]);
    await testManager.run(request, new CancellationTokenSource().token);

    expect(enqueuedSpy).toHaveBeenCalledTimes(4);
    expect(passedSpy).toHaveBeenCalledTimes(1);
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
    expect(failedSpy).toHaveBeenCalledTimes(2);
    expect(failedSpy).toHaveBeenCalledWith(
      childItems[2],
      [
        {
          message: "Test failed",
        },
      ],
      11000,
    );
    expect(failedSpy).toHaveBeenCalledWith(
      childItems[3],
      [
        {
          message: "Test failed",
        },
        {
          message: "abc",
          location: new Location(
            Uri.file(mockTestsInfo.kPath),
            new Range(0, 0, 1, 1),
          ),
        },
      ],
      15000,
    );
    expect(endSpy).toHaveBeenCalledTimes(1);
  });
});
