import { createMockLogger } from "../../../__mocks__/loggerMock";
import type { DatabaseItem } from "../../../../src/databases/local-databases";
import { DatabaseKind } from "../../../../src/databases/local-databases";
import { file } from "tmp-promise";
import { QueryResultType } from "../../../../src/query-server/messages";
import { mockedObject, mockedUri } from "../../utils/mocking.helpers";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { QueryRunner } from "../../../../src/query-server";
import { join } from "path";
import { CancellationTokenSource } from "vscode-jsonrpc";
import { QueryOutputDir } from "../../../../src/local-queries/query-output-dir";
import { runGenerateQueries } from "../../../../src/model-editor/generate";
import { ruby } from "../../../../src/model-editor/languages/ruby";
import type { ModeledMethod } from "../../../../src/model-editor/modeled-method";
import { EndpointType } from "../../../../src/model-editor/method";
import { Mode } from "../../../../src/model-editor/shared/mode";
import { defaultModelConfig } from "../../../../src/model-editor/languages";

describe("runGenerateQueries", () => {
  const modelsAsDataLanguage = ruby;
  const modelGeneration = modelsAsDataLanguage.modelGeneration;
  if (!modelGeneration) {
    throw new Error("Test requires a model generation step");
  }

  it("should run the query and return the results", async () => {
    const queryStorageDir = (await file()).path;
    const outputDir = new QueryOutputDir(join(queryStorageDir, "1"));

    const onResults = jest.fn();

    const options = {
      cliServer: mockedObject<CodeQLCliServer>({
        resolveQueriesInSuite: jest
          .fn()
          .mockResolvedValue(["/a/b/c/GenerateModel.ql"]),
        bqrsDecodeAll: jest.fn().mockResolvedValue({
          sourceModel: {
            columns: [
              { name: "type", kind: "String" },
              { name: "path", kind: "String" },
              { name: "kind", kind: "String" },
            ],
            tuples: [],
          },
          sinkModel: {
            columns: [
              { name: "type", kind: "String" },
              { name: "path", kind: "String" },
              { name: "kind", kind: "String" },
            ],
            tuples: [],
          },
          typeVariableModel: {
            columns: [
              { name: "name", kind: "String" },
              { name: "path", kind: "String" },
            ],
            tuples: [],
          },
          typeModel: {
            columns: [
              { name: "type1", kind: "String" },
              { name: "type2", kind: "String" },
              { name: "path", kind: "String" },
            ],
            tuples: [
              ["Array", "SQLite3::ResultSet", "Method[types].ReturnValue"],
              ["Array", "SQLite3::ResultSet", "Method[columns].ReturnValue"],
              ["Array", "SQLite3::Statement", "Method[types].ReturnValue"],
              ["Array", "SQLite3::Statement", "Method[columns].ReturnValue"],
            ],
          },
          summaryModel: {
            columns: [
              { name: "type", kind: "String" },
              { name: "path", kind: "String" },
              { name: "input", kind: "String" },
              { name: "output", kind: "String" },
              { name: "kind", kind: "String" },
            ],
            tuples: [
              [
                "SQLite3::Database",
                "Method[create_function]",
                "Argument[self]",
                "ReturnValue",
                "value",
              ],
              [
                "SQLite3::Value!",
                "Method[new]",
                "Argument[1]",
                "ReturnValue",
                "value",
              ],
            ],
          },
        }),
      }),
      queryRunner: mockedObject<QueryRunner>({
        createQueryRun: jest.fn().mockReturnValue({
          evaluate: jest.fn().mockResolvedValue({
            resultType: QueryResultType.SUCCESS,
            outputDir,
          }),
          outputDir,
        }),
        logger: createMockLogger(),
      }),
      databaseItem: mockedObject<DatabaseItem>({
        databaseUri: mockedUri("/a/b/c/src.zip"),
        contents: {
          kind: DatabaseKind.Database,
          name: "foo",
          datasetUri: mockedUri(),
        },
        language: "ruby",
        getSourceLocationPrefix: jest
          .fn()
          .mockResolvedValue("/home/runner/work/my-repo/my-repo"),
        sourceArchive: mockedUri("/a/b/c/src.zip"),
      }),
      queryStorageDir: "/tmp/queries",
      progress: jest.fn(),
      token: new CancellationTokenSource().token,
    };

    await runGenerateQueries({
      queryConstraints: modelGeneration.queryConstraints(Mode.Framework),
      filterQueries: modelGeneration.filterQueries,
      onResults: (queryPath, results) => {
        onResults(
          modelGeneration.parseResults(
            queryPath,
            results,
            modelsAsDataLanguage,
            createMockLogger(),
            {
              mode: Mode.Framework,
              config: defaultModelConfig,
            },
          ),
        );
      },
      ...options,
    });
    expect(onResults).toHaveBeenCalledWith([
      {
        endpointType: EndpointType.Method,
        methodName: "types",
        methodParameters: "",
        packageName: "",
        path: "ReturnValue",
        relatedTypeName: "Array",
        signature: "SQLite3::ResultSet#types",
        type: "type",
        typeName: "SQLite3::ResultSet",
      },
      {
        endpointType: EndpointType.Method,
        methodName: "columns",
        methodParameters: "",
        packageName: "",
        path: "ReturnValue",
        relatedTypeName: "Array",
        signature: "SQLite3::ResultSet#columns",
        type: "type",
        typeName: "SQLite3::ResultSet",
      },
      {
        endpointType: EndpointType.Method,
        methodName: "types",
        methodParameters: "",
        packageName: "",
        path: "ReturnValue",
        relatedTypeName: "Array",
        signature: "SQLite3::Statement#types",
        type: "type",
        typeName: "SQLite3::Statement",
      },
      {
        endpointType: EndpointType.Method,
        methodName: "columns",
        methodParameters: "",
        packageName: "",
        path: "ReturnValue",
        relatedTypeName: "Array",
        signature: "SQLite3::Statement#columns",
        type: "type",
        typeName: "SQLite3::Statement",
      },
      {
        endpointType: EndpointType.Method,
        input: "Argument[self]",
        kind: "value",
        methodName: "create_function",
        methodParameters: "",
        output: "ReturnValue",
        packageName: "",
        provenance: "manual",
        signature: "SQLite3::Database#create_function",
        type: "summary",
        typeName: "SQLite3::Database",
      },
      {
        endpointType: EndpointType.Constructor,
        input: "Argument[1]",
        kind: "value",
        methodName: "new",
        methodParameters: "",
        output: "ReturnValue",
        packageName: "",
        provenance: "manual",
        signature: "SQLite3::Value!#new",
        type: "summary",
        typeName: "SQLite3::Value!",
      },
    ] satisfies ModeledMethod[]);

    expect(options.queryRunner.createQueryRun).toHaveBeenCalledTimes(1);
    expect(options.queryRunner.createQueryRun).toHaveBeenCalledWith(
      "/a/b/c/src.zip",
      {
        queryPath: "/a/b/c/GenerateModel.ql",
        quickEvalPosition: undefined,
        quickEvalCountOnly: false,
      },
      false,
      [],
      undefined,
      {},
      "/tmp/queries",
      undefined,
      undefined,
    );
  });
});
