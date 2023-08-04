import {
  createAutoModelV2Request,
  encodeSarif,
  getCandidates,
} from "../../../src/data-extensions-editor/auto-model-v2";
import { Mode } from "../../../src/data-extensions-editor/shared/mode";
import { AutomodelMode } from "../../../src/data-extensions-editor/auto-model-api-v2";
import { AutoModelQueriesResult } from "../../../src/data-extensions-editor/auto-model-codeml-queries";
import * as sarif from "sarif";
import { gzipDecode } from "../../../src/common/zlib";
import { ExternalApiUsage } from "../../../src/data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../../src/data-extensions-editor/modeled-method";

describe("createAutoModelV2Request", () => {
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
    expect(await createAutoModelV2Request(Mode.Application, result)).toEqual({
      mode: AutomodelMode.Application,
      candidates: await encodeSarif(result.candidates),
    });
  });

  it("can decode the SARIF", async () => {
    const request = await createAutoModelV2Request(Mode.Application, result);
    const decoded = Buffer.from(request.candidates, "base64");
    const decompressed = await gzipDecode(decoded);
    const json = decompressed.toString("utf-8");
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(result.candidates);
  });
});

describe("getCandidates", () => {
  it("doesn't return methods that are already modelled", () => {
    const externalApiUsages: ExternalApiUsage[] = [];
    externalApiUsages.push({
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
    const modeledMethods: Record<string, ModeledMethod> = {
      "org.my.A#x()": {
        type: "neutral",
        kind: "",
        input: "",
        output: "",
        provenance: "manual",
        signature: "org.my.A#x()",
        packageName: "org.my",
        typeName: "A",
        methodName: "x",
        methodParameters: "()",
      },
    };
    const candidates = getCandidates(
      Mode.Application,
      externalApiUsages,
      modeledMethods,
    );
    expect(candidates.length).toEqual(0);
  });

  it("doesn't return methods that are supported from other sources", () => {
    const externalApiUsages: ExternalApiUsage[] = [];
    externalApiUsages.push({
      library: "my.jar",
      signature: "org.my.A#x()",
      packageName: "org.my",
      typeName: "A",
      methodName: "x",
      methodParameters: "()",
      supported: true,
      supportedType: "none",
      usages: [],
    });
    const modeledMethods = {};
    const candidates = getCandidates(
      Mode.Application,
      externalApiUsages,
      modeledMethods,
    );
    expect(candidates.length).toEqual(0);
  });

  it("returns methods that are neither modeled nor supported from other sources", () => {
    const externalApiUsages: ExternalApiUsage[] = [];
    externalApiUsages.push({
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
    const candidates = getCandidates(
      Mode.Application,
      externalApiUsages,
      modeledMethods,
    );
    expect(candidates.length).toEqual(1);
  });

  it("respects the limit", () => {
    const externalApiUsages: ExternalApiUsage[] = [];
    for (let i = 0; i < 30; i++) {
      externalApiUsages.push({
        library: "my.jar",
        signature: `org.my.A#x${i}()`,

        packageName: "org.my",
        typeName: "A",
        methodName: `x${i}`,
        methodParameters: "()",
        supported: false,
        supportedType: "none",
        usages: [],
      });
    }
    const modeledMethods = {};
    const candidates = getCandidates(
      Mode.Application,
      externalApiUsages,
      modeledMethods,
    );
    expect(candidates.length).toEqual(20);
  });
});
