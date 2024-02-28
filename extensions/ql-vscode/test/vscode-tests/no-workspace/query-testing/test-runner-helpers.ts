import { Uri } from "vscode";
import { mockedObject } from "../../utils/mocking.helpers";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { DatabaseManager } from "../../../../src/databases/local-databases";

/**
 * Fake QL tests used by various tests.
 */
export const mockTestsInfo = {
  testsPath: Uri.parse("file:/ab/c").fsPath,
  dPath: Uri.parse("file:/ab/c/d.ql").fsPath,
  gPath: Uri.parse("file:/ab/c/e/f/g.ql").fsPath,
  hPath: Uri.parse("file:/ab/c/e/f/h.ql").fsPath,
  kPath: Uri.parse("file:/ab/c/e/f/k.ql").fsPath,
};

/**
 * Create a mock of a `DatabaseManager` with no databases loaded.
 */
export function mockEmptyDatabaseManager(): DatabaseManager {
  return mockedObject<DatabaseManager>({
    currentDatabaseItem: undefined,
    databaseItems: [],
  });
}

/**
 * Creates a `CodeQLCliServer` that "runs" the mock tests. Also returns the spy
 * hook for the `runTests` function on the CLI server.
 */
export function createMockCliServerForTestRun() {
  const resolveQlpacksSpy = jest.fn();
  resolveQlpacksSpy.mockResolvedValue({});

  const resolveTestsSpy = jest.fn();
  resolveTestsSpy.mockResolvedValue([]);

  const runTestsSpy = mockRunTests();
  return {
    cliServer: mockedObject<CodeQLCliServer>({
      runTests: runTestsSpy,
      resolveQlpacks: resolveQlpacksSpy,
      resolveTests: resolveTestsSpy,
    }),
    runTestsSpy,
  };
}

function mockRunTests(): jest.Mock<any, any> {
  const runTestsSpy = jest.fn();
  // runTests is an async generator function. This is not directly supported in sinon
  // However, we can pretend the same thing by just returning an async array.
  runTestsSpy.mockReturnValue(
    (async function* () {
      yield Promise.resolve({
        test: mockTestsInfo.dPath,
        pass: true,
        messages: [],
        compilationMs: 1000,
        evaluationMs: 2000,
      });
      yield Promise.resolve({
        test: mockTestsInfo.gPath,
        pass: false,
        diff: ["pqr", "xyz"],
        // a compile error
        failureStage: "COMPILATION",
        compilationMs: 4000,
        evaluationMs: 0,
        messages: [
          {
            position: {
              fileName: mockTestsInfo.gPath,
              line: 1,
              column: 1,
              endLine: 2,
              endColumn: 2,
            },
            message: "abc",
            severity: "ERROR",
          },
        ],
      });
      yield Promise.resolve({
        test: mockTestsInfo.hPath,
        pass: false,
        diff: ["jkh", "tuv"],
        failureStage: "RESULT",
        compilationMs: 5000,
        evaluationMs: 6000,
        messages: [],
      });
      yield Promise.resolve({
        test: mockTestsInfo.kPath,
        pass: false,
        diff: ["jkh", "tuv"],
        failureStage: "RESULT",
        compilationMs: 7000,
        evaluationMs: 8000,
        // a warning in an otherwise successful test
        messages: [
          {
            position: {
              fileName: mockTestsInfo.kPath,
              line: 1,
              column: 1,
              endLine: 2,
              endColumn: 2,
            },
            message: "abc",
            severity: "WARNING",
          },
        ],
      });
    })(),
  );

  return runTestsSpy;
}
