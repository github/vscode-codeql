import { AutomodelMode, ModelRequest } from "./auto-model-api";
import { Mode } from "./shared/mode";
import { AutoModelQueriesResult } from "./auto-model-codeml-queries";
import { assertNever } from "../common/helpers-pure";
import * as Sarif from "sarif";
import { gzipEncode } from "../common/zlib";
import { Method, MethodSignature } from "./method";
import { ModeledMethod } from "./modeled-method";
import { groupMethods, sortGroupNames, sortMethods } from "./shared/sorting";

/**
 * Return the candidates that the model should be run on. This includes limiting the number of
 * candidates to the candidate limit and filtering out anything that is already modeled and respecting
 * the order in the UI.
 * @param mode Whether it is application or framework mode.
 * @param methods all methods.
 * @param modeledMethods the currently modeled methods.
 * @returns list of modeled methods that are candidates for modeling.
 */
export function getCandidates(
  mode: Mode,
  methods: Method[],
  modeledMethods: Record<string, ModeledMethod>,
): MethodSignature[] {
  // Sort the same way as the UI so we send the first ones listed in the UI first
  const grouped = groupMethods(methods, mode);
  const sortedGroupNames = sortGroupNames(grouped);
  const sortedExternalApiUsages = sortedGroupNames.flatMap((name) =>
    sortMethods(grouped[name]),
  );

  const candidates: MethodSignature[] = [];

  for (const method of sortedExternalApiUsages) {
    const modeledMethod: ModeledMethod = modeledMethods[method.signature] ?? {
      type: "none",
    };

    // Anything that is modeled is not a candidate
    if (modeledMethod.type !== "none") {
      continue;
    }

    // A method that is supported is modeled outside of the model file, so it is not a candidate.
    if (method.supported) {
      continue;
    }

    // The rest are candidates
    candidates.push(method);
  }
  return candidates;
}

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

export async function createAutoModelRequest(
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
