import { AutomodelMode, ModelRequest } from "./auto-model-api-v2";
import { Mode } from "./shared/mode";
import { AutoModelQueriesResult } from "./auto-model-codeml-queries";
import { assertNever } from "../common/helpers-pure";
import * as Sarif from "sarif";
import { gzipEncode } from "../common/zlib";

/**
 * Encode a SARIF log to the format expected by the server: JSON, GZIP-compressed, base64-encoded
 * @param log SARIF log to encode
 * @returns base64-encoded GZIP-compressed SARIF log
 */
export async function encodeSarif(log: Sarif.Log): Promise<string> {
  const json = JSON.stringify(log);
  const buffer = Buffer.from(json, "utf-8");
  const compressed = await gzipEncode(buffer);
  return compressed.toString("base64");
}

export async function createAutoModelV2Request(
  mode: Mode,
  result: AutoModelQueriesResult,
): Promise<ModelRequest> {
  let requestMode: AutomodelMode;
  switch (mode) {
    case Mode.Application:
      requestMode = AutomodelMode.Application;
      break;
    case Mode.Framework:
      requestMode = AutomodelMode.Framework;
      break;
    default:
      assertNever(mode);
  }

  return {
    mode: requestMode,
    candidates: await encodeSarif(result.candidates),
  };
}
