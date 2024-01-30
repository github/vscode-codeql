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
  it("should run query", async () => {
    const language = QueryLanguage.Ruby;
    const outputDir = new QueryOutputDir(join((await file()).path, "1"));

    const options = {
      parseResults: jest.fn().mockResolvedValue([]),
      cliServer: mockedObject<CodeQLCliServer>({
        resolveQlpacks: jest.fn().mockResolvedValue({
          "my/extensions": "/a/b/c/",
        }),
        resolveQueriesInSuite: jest
          .fn()
          .mockResolvedValue(["/a/b/c/FrameworkModeAccessPathSuggestions.ql"]),
        packPacklist: jest
          .fn()
          .mockResolvedValue([
            "/a/b/c/qlpack.yml",
            "/a/b/c/qlpack.lock.yml",
            "/a/b/c/qlpack2.yml",
          ]),
        bqrsDecodeAll: jest.fn().mockResolvedValue([]),
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

    expect(result).not.toBeUndefined;

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
  });
});
