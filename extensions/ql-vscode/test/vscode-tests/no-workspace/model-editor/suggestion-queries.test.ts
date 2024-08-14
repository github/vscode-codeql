import { load } from "js-yaml";
import { readFile } from "fs-extra";
import { createMockLogger } from "../../../__mocks__/loggerMock";
import type { DatabaseItem } from "../../../../src/databases/local-databases";
import { DatabaseKind } from "../../../../src/databases/local-databases";
import { file } from "tmp-promise";
import { QueryResultType } from "../../../../src/query-server/messages";
import { QueryLanguage } from "../../../../src/common/query-language";
import { mockedObject, mockedUri } from "../../utils/mocking.helpers";
import { Mode } from "../../../../src/model-editor/shared/mode";
import { join } from "path";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { QueryRunner } from "../../../../src/query-server";
import { QueryOutputDir } from "../../../../src/local-queries/query-output-dir";
import { runSuggestionsQuery } from "../../../../src/model-editor/suggestion-queries";

describe("runSuggestionsQuery", () => {
  const mockDecodedBqrs = {
    input: {
      columns: [
        {
          name: "type",
          kind: "String",
        },
        {
          name: "path",
          kind: "String",
        },
        {
          name: "value",
          kind: "String",
        },
        {
          name: "node",
          kind: "Entity",
        },
        {
          name: "defType",
          kind: "String",
        },
      ],
      tuples: [
        [
          "Correctness",
          "Method[assert!]",
          "Argument[self]",
          {
            label: "self in assert!",
          },
          "parameter",
        ],
      ],
    },
    output: {
      columns: [
        {
          name: "type",
          kind: "String",
        },
        {
          name: "path",
          kind: "String",
        },
        {
          name: "value",
          kind: "String",
        },
        {
          name: "node",
          kind: "Entity",
        },
        {
          name: "defType",
          kind: "String",
        },
      ],
      tuples: [
        [
          "Correctness",
          "Method[assert!]",
          "ReturnValue",
          {
            label: "call to puts",
          },
          "return",
        ],
        [
          "Correctness",
          "Method[assert!]",
          "Argument[self]",
          {
            label: "self in assert!",
          },
          "parameter",
        ],
      ],
    },
  };
  const mockInputSuggestions = [
    {
      method: {
        packageName: "",
        typeName: "Correctness",
        methodName: "assert!",
        methodParameters: "",
        signature: "Correctness#assert!",
      },
      value: "Argument[self]",
      details: "self in assert!",
      definitionType: "parameter",
    },
  ];
  const mockOutputSuggestions = [
    {
      method: {
        packageName: "",
        typeName: "Correctness",
        methodName: "assert!",
        methodParameters: "",
        signature: "Correctness#assert!",
      },
      value: "ReturnValue",
      details: "call to puts",
      definitionType: "return",
    },
    {
      method: {
        packageName: "",
        typeName: "Correctness",
        methodName: "assert!",
        methodParameters: "",
        signature: "Correctness#assert!",
      },
      value: "Argument[self]",
      details: "self in assert!",
      definitionType: "parameter",
    },
  ];

  it("should run query", async () => {
    const language = QueryLanguage.Ruby;
    const outputDir = new QueryOutputDir(join((await file()).path, "1"));

    const parseResults = jest
      .fn()
      .mockResolvedValueOnce(mockInputSuggestions)
      .mockResolvedValueOnce(mockOutputSuggestions);

    const resolveQueriesInSuite = jest
      .fn()
      .mockResolvedValue(["/a/b/c/FrameworkModeAccessPathSuggestions.ql"]);

    const options = {
      parseResults,
      queryConstraints: {
        kind: "table",
        "tags all": ["modeleditor", "access-paths", "ruby", "foo"],
      },
      cliServer: mockedObject<CodeQLCliServer>({
        resolveQlpacks: jest.fn().mockResolvedValue({
          "my/extensions": "/a/b/c/",
        }),
        resolveQueriesInSuite,
        packPacklist: jest
          .fn()
          .mockResolvedValue([
            "/a/b/c/qlpack.yml",
            "/a/b/c/qlpack.lock.yml",
            "/a/b/c/qlpack2.yml",
          ]),
        bqrsDecodeAll: jest.fn().mockResolvedValue(mockDecodedBqrs),
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
      logger: createMockLogger(),
      databaseItem: mockedObject<DatabaseItem>({
        databaseUri: mockedUri("/a/b/c/src.zip"),
        contents: {
          kind: DatabaseKind.Database,
          name: "foo",
          datasetUri: mockedUri(),
        },
        language,
      }),
      queryStorageDir: "/tmp/queries",
      progress: jest.fn(),
      token: {
        isCancellationRequested: false,
        onCancellationRequested: jest.fn(),
      },
    };

    const result = await runSuggestionsQuery(Mode.Framework, options);

    expect(result).not.toBeUndefined();

    expect(options.cliServer.resolveQlpacks).toHaveBeenCalledTimes(1);
    expect(options.cliServer.resolveQlpacks).toHaveBeenCalledWith([], true);
    expect(options.queryRunner.createQueryRun).toHaveBeenCalledWith(
      "/a/b/c/src.zip",
      {
        queryPath: expect.stringMatching(/\S*AccessPathSuggestions\.ql/),
        quickEvalPosition: undefined,
        quickEvalCountOnly: false,
      },
      false,
      [],
      ["my/extensions"],
      {},
      "/tmp/queries",
      undefined,
      undefined,
    );
    expect(options.cliServer.resolveQueriesInSuite).toHaveBeenCalledTimes(1);

    expect(
      load(await readFile(resolveQueriesInSuite.mock.calls[0][0], "utf-8")),
    ).toEqual([
      {
        from: "codeql/ruby-queries",
        include: {
          kind: "table",
          "tags all": ["modeleditor", "access-paths", "ruby", "foo"],
        },
        queries: ".",
      },
    ]);

    expect(options.parseResults).toHaveBeenCalledTimes(2);

    expect(result).toEqual({
      input: mockInputSuggestions,
      output: mockOutputSuggestions,
    });
  });
});
