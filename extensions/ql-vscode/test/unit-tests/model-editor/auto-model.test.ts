import {
  createAutoModelRequest,
  encodeSarif,
  getCandidates,
} from "../../../src/model-editor/auto-model";
import { Mode } from "../../../src/model-editor/shared/mode";
import { AutomodelMode } from "../../../src/model-editor/auto-model-api";
import { AutoModelQueriesResult } from "../../../src/model-editor/auto-model-codeml-queries";
import * as sarif from "sarif";
import { gzipDecode } from "../../../src/common/zlib";
import { Method } from "../../../src/model-editor/method";
import { ModeledMethod } from "../../../src/model-editor/modeled-method";

describe("createAutoModelRequest", () => {
  const createSarifLog = (queryId: string): sarif.Log => {
    return {
      version: "2.1.0",
      $schema: "http://json.schemastore.org/sarif-2.1.0-rtm.4",
      runs: [
        {
          tool: {
            driver: {
              name: "CodeQL",
              rules: [
                {
                  id: queryId,
                },
              ],
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
    };
  };

  const result: AutoModelQueriesResult = {
    candidates: createSarifLog(
      "java/ml/extract-automodel-application-candidates",
    ),
  };

  it("creates a matching request", async () => {
    expect(await createAutoModelRequest(Mode.Application, result)).toEqual({
      mode: AutomodelMode.Application,
      candidates: await encodeSarif(result.candidates),
    });
  });

  it("can decode the SARIF", async () => {
    const request = await createAutoModelRequest(Mode.Application, result);
    const decoded = Buffer.from(request.candidates, "base64");
    const decompressed = await gzipDecode(decoded);
    const json = decompressed.toString("utf-8");
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(result.candidates);
  });
});

describe("getCandidates", () => {
  it("doesn't return methods that are already modelled", () => {
    const methods: Method[] = [
      {
        library: "my.jar",
        signature: "org.my.A#x()",
        packageName: "org.my",
        typeName: "A",
        methodName: "x",
        methodParameters: "()",
        supported: false,
        supportedType: "none",
        usages: [],
      },
    ];
    const modeledMethods: Record<string, ModeledMethod[]> = {
      "org.my.A#x()": [
        {
          type: "neutral",
          kind: "sink",
          provenance: "manual",
          signature: "org.my.A#x()",
          packageName: "org.my",
          typeName: "A",
          methodName: "x",
          methodParameters: "()",
        },
      ],
    };
    const candidates = getCandidates(Mode.Application, methods, modeledMethods);
    expect(candidates.length).toEqual(0);
  });

  it("doesn't return methods that are supported from other sources", () => {
    const methods: Method[] = [
      {
        library: "my.jar",
        signature: "org.my.A#x()",
        packageName: "org.my",
        typeName: "A",
        methodName: "x",
        methodParameters: "()",
        supported: true,
        supportedType: "none",
        usages: [],
      },
    ];
    const modeledMethods = {};
    const candidates = getCandidates(Mode.Application, methods, modeledMethods);
    expect(candidates.length).toEqual(0);
  });

  it("returns methods that are neither modeled nor supported from other sources", () => {
    const methods: Method[] = [];
    methods.push({
      library: "my.jar",
      signature: "org.my.A#x()",
      packageName: "org.my",
      typeName: "A",
      methodName: "x",
      methodParameters: "()",
      supported: false,
      supportedType: "none",
      usages: [],
    });
    const modeledMethods = {};
    const candidates = getCandidates(Mode.Application, methods, modeledMethods);
    expect(candidates.length).toEqual(1);
  });
});
