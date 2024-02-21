import {
  createAutoModelRequest,
  encodeSarif,
} from "../../../src/model-editor/auto-model";
import { Mode } from "../../../src/model-editor/shared/mode";
import { AutomodelMode } from "../../../src/model-editor/auto-model-api";
import type { AutoModelQueriesResult } from "../../../src/model-editor/auto-model-codeml-queries";
import type { Log } from "sarif";
import { gzipDecode } from "../../../src/common/zlib";

describe("createAutoModelRequest", () => {
  const createSarifLog = (queryId: string): Log => {
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
