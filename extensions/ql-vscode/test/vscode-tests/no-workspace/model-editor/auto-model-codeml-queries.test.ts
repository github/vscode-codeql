import { createMockLogger } from "../../../__mocks__/loggerMock";
import {
  DatabaseItem,
  DatabaseKind,
} from "../../../../src/databases/local-databases";
import { file } from "tmp-promise";
import { QueryResultType } from "../../../../src/query-server/new-messages";
import {
  generateCandidateFilterPack,
  runAutoModelQueries,
} from "../../../../src/model-editor/auto-model-codeml-queries";
import { Mode } from "../../../../src/model-editor/shared/mode";
import { mockedObject, mockedUri } from "../../utils/mocking.helpers";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { QueryRunner } from "../../../../src/query-server";
import * as queryResolver from "../../../../src/local-queries/query-resolver";
import { MethodSignature } from "../../../../src/model-editor/method";
import { join } from "path";
import { exists, readFile } from "fs-extra";
import { load as loadYaml } from "js-yaml";
import { CancellationTokenSource } from "vscode-jsonrpc";
import { QueryOutputDir } from "../../../../src/run-queries-shared";

describe("runAutoModelQueries", () => {
  let resolveQueriesSpy: jest.SpiedFunction<
    typeof queryResolver.resolveQueries
  >;
  beforeEach(() => {
    resolveQueriesSpy = jest
      .spyOn(queryResolver, "resolveQueries")
      .mockImplementation(
        async (_cliServer, _packsToSearch, _name, constraints) => {
          if (constraints["tags contain all"]?.includes("candidates")) {
            return ["/a/b/c/ql/candidates.ql"];
          }
          if (constraints["tags contain all"]?.includes("positive")) {
            return ["/a/b/c/ql/positive-examples.ql"];
          }
          if (constraints["tags contain all"]?.includes("negative")) {
            return ["/a/b/c/ql/negative-examples.ql"];
          }

          return [];
        },
      );
  });

  it("should run the query and return the results", async () => {
    const queryStorageDir = (await file()).path;
    const outputDir = new QueryOutputDir(join(queryStorageDir, "1"));

    const options = {
      mode: Mode.Application,
      candidateMethods: [],
      cliServer: mockedObject<CodeQLCliServer>({
        resolveQlpacks: jest.fn().mockResolvedValue({
          "/a/b/c/my-extension-pack": {},
        }),
        resolveMetadata: jest.fn().mockResolvedValue({
          kind: "problem",
        }),
        interpretBqrsSarif: jest.fn().mockResolvedValue({
          version: "2.1.0",
          $schema: "http://json.schemastore.org/sarif-2.1.0-rtm.4",
          runs: [
            {
              tool: {
                driver: {
                  name: "CodeQL",
                },
              },
              results: [
                {
                  message: {
                    text: "msg",
                  },
                  locations: [
                    {
                      physicalLocation: {
                        contextRegion: {
                          startLine: 10,
                          endLine: 12,
                          snippet: {
                            text: "Foo",
                          },
                        },
                        region: {
                          startLine: 10,
                          startColumn: 1,
                          endColumn: 3,
                        },
                        artifactLocation: {
                          uri: "foo.js",
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ],
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
        language: "java",
        getSourceLocationPrefix: jest
          .fn()
          .mockResolvedValue("/home/runner/work/my-repo/my-repo"),
        sourceArchive: mockedUri("/a/b/c/src.zip"),
      }),
      queryStorageDir: "/tmp/queries",
      progress: jest.fn(),
      cancellationTokenSource: new CancellationTokenSource(),
    };

    const result = await runAutoModelQueries(options);
    expect(result).not.toBeUndefined();

    expect(options.cliServer.resolveQlpacks).toHaveBeenCalledTimes(1);
    expect(options.cliServer.resolveQlpacks).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("tmp")]),
      true,
    );
    expect(resolveQueriesSpy).toHaveBeenCalledTimes(1);
    expect(resolveQueriesSpy).toHaveBeenCalledWith(
      options.cliServer,
      ["codeql/java-automodel-queries"],
      "Extract automodel candidates",
      {
        kind: "problem",
        "tags contain all": ["automodel", "application-mode", "candidates"],
      },
    );
    expect(options.queryRunner.createQueryRun).toHaveBeenCalledTimes(1);
    expect(options.queryRunner.createQueryRun).toHaveBeenCalledWith(
      "/a/b/c/src.zip",
      {
        queryPath: "/a/b/c/ql/candidates.ql",
        quickEvalPosition: undefined,
        quickEvalCountOnly: false,
      },
      false,
      expect.arrayContaining([expect.stringContaining("tmp")]),
      ["/a/b/c/my-extension-pack"],
      "/tmp/queries",
      undefined,
      undefined,
    );
  });
});

describe("generateCandidateFilterPack", () => {
  it("should create a temp pack containing the candidate filters", async () => {
    const candidateMethods: MethodSignature[] = [
      {
        signature: "org.my.A#x()",
        packageName: "org.my",
        typeName: "A",
        methodName: "x",
        methodParameters: "()",
      },
    ];
    const packDir = await generateCandidateFilterPack("java", candidateMethods);
    expect(packDir).not.toBeUndefined();
    const qlpackFile = join(packDir, "codeql-pack.yml");
    expect(await exists(qlpackFile)).toBe(true);
    const filterFile = join(packDir, "filter.yml");
    expect(await exists(filterFile)).toBe(true);
    // Read the contents of filterFile and parse as yaml
    const yaml = await loadYaml(await readFile(filterFile, "utf8"));
    const extensions = yaml.extensions;
    expect(extensions).toBeInstanceOf(Array);
    expect(extensions).toHaveLength(1);
    const extension = extensions[0];
    expect(extension.addsTo.pack).toEqual("codeql/java-automodel-queries");
    expect(extension.addsTo.extensible).toEqual("automodelCandidateFilter");
    expect(extension.data).toBeInstanceOf(Array);
    expect(extension.data).toHaveLength(1);
    expect(extension.data[0]).toEqual(["org.my", "A", "x", "()"]);
  });
});
