import { CancellationTokenSource, Uri } from "vscode";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import {
  DatabaseItem,
  DatabaseItemImpl,
  DatabaseManager,
  FullDatabaseOptions,
} from "../../../../src/databases/local-databases";
import { mockedObject } from "../../utils/mocking.helpers";
import { TestRunner } from "../../../../src/query-testing/test-runner";
import { createMockLogger } from "../../../__mocks__/loggerMock";
import {
  createMockCliServerForTestRun,
  mockTestsInfo,
} from "./test-runner-helpers";

jest.mock("fs-extra", () => {
  const original = jest.requireActual("fs-extra");
  return {
    ...original,
    access: jest.fn(),
  };
});

describe("test-runner", () => {
  let testRunner: TestRunner;
  let fakeDatabaseManager: DatabaseManager;
  let fakeCliServer: CodeQLCliServer;
  let currentDatabaseItem: DatabaseItem | undefined;
  let databaseItems: DatabaseItem[] = [];
  const openDatabaseSpy = jest.fn();
  const removeDatabaseItemSpy = jest.fn();
  const renameDatabaseItemSpy = jest.fn();
  const setCurrentDatabaseItemSpy = jest.fn();
  let runTestsSpy: jest.Mock<any, any>;
  const resolveTestsSpy = jest.fn();
  const resolveQlpacksSpy = jest.fn();

  const preTestDatabaseItem = new DatabaseItemImpl(
    Uri.file("/path/to/test/dir/dir.testproj"),
    undefined,
    mockedObject<FullDatabaseOptions>({ displayName: "custom display name" }),
  );
  const postTestDatabaseItem = new DatabaseItemImpl(
    Uri.file("/path/to/test/dir/dir.testproj"),
    undefined,
    mockedObject<FullDatabaseOptions>({ displayName: "default name" }),
  );

  beforeEach(() => {
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

    const mockCli = createMockCliServerForTestRun();
    fakeCliServer = mockCli.cliServer;
    runTestsSpy = mockCli.runTestsSpy;

    testRunner = new TestRunner(fakeDatabaseManager, fakeCliServer);
  });

  it("should run some tests", async () => {
    const eventHandlerSpy = jest.fn();

    await testRunner.run(
      [mockTestsInfo.dPath, mockTestsInfo.gPath, mockTestsInfo.hPath],
      createMockLogger(),
      new CancellationTokenSource().token,
      eventHandlerSpy,
    );

    expect(eventHandlerSpy).toBeCalledTimes(3);

    expect(eventHandlerSpy).toHaveBeenNthCalledWith(1, {
      test: mockTestsInfo.dPath,
      pass: true,
      compilationMs: 1000,
      evaluationMs: 2000,
      messages: [],
    });
    expect(eventHandlerSpy).toHaveBeenNthCalledWith(2, {
      test: mockTestsInfo.gPath,
      pass: false,
      compilationMs: 4000,
      evaluationMs: 0,
      diff: ["pqr", "xyz"],
      failureStage: "COMPILATION",
      messages: [
        {
          message: "abc",
          position: {
            line: 1,
            column: 1,
            endLine: 2,
            endColumn: 2,
            fileName: mockTestsInfo.gPath,
          },
          severity: "ERROR",
        },
      ],
    });
    expect(eventHandlerSpy).toHaveBeenNthCalledWith(3, {
      test: mockTestsInfo.hPath,
      pass: false,
      compilationMs: 5000,
      evaluationMs: 6000,
      diff: ["jkh", "tuv"],
      failureStage: "RESULT",
      messages: [],
    });
  });

  it("should reregister testproj databases around test run", async () => {
    currentDatabaseItem = preTestDatabaseItem;
    databaseItems = [preTestDatabaseItem];
    await testRunner.run(
      ["/path/to/test/dir"],
      createMockLogger(),
      new CancellationTokenSource().token,
      async () => {
        /***/
      },
    );

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
    expect(removeDatabaseItemSpy).toBeCalledWith(preTestDatabaseItem);

    expect(openDatabaseSpy).toBeCalledTimes(1);
    expect(openDatabaseSpy).toBeCalledWith(
      preTestDatabaseItem.databaseUri,
      false,
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
});
