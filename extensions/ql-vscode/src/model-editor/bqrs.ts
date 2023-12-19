import { DecodedBqrsChunk, BqrsEntityValue } from "../common/bqrs-cli-types";
import { CallClassification, Method, Usage } from "./method";
import { ModeledMethodType } from "./modeled-method";
import { parseLibraryFilename } from "./library";
import { Mode } from "./shared/mode";
import { ApplicationModeTuple, FrameworkModeTuple } from "./queries/query";
import { QueryLanguage } from "../common/query-language";
import { getModelsAsDataLanguage } from "./languages";
import { mapUrlValue } from "../common/bqrs-raw-results-mapper";
import { isUrlValueResolvable } from "../common/raw-result-types";

export function decodeBqrsToMethods(
  chunk: DecodedBqrsChunk,
  mode: Mode,
  language: QueryLanguage,
): Method[] {
  const methodsByApiName = new Map<string, Method>();

  const definition = getModelsAsDataLanguage(language);

  chunk?.tuples.forEach((tuple) => {
    let usageEntityValue: BqrsEntityValue;
    let packageName: string;
    let typeName: string;
    let methodName: string;
    let methodParameters: string;
    let supported: boolean;
    let library: string;
    let libraryVersion: string | undefined;
    let type: ModeledMethodType;
    let classification: CallClassification;

    if (mode === Mode.Application) {
      [
        usageEntityValue,
        packageName,
        typeName,
        methodName,
        methodParameters,
        supported,
        library,
        libraryVersion,
        type,
        classification,
      ] = tuple as ApplicationModeTuple;
    } else {
      [
        usageEntityValue,
        packageName,
        typeName,
        methodName,
        methodParameters,
        supported,
        library,
        type,
      ] = tuple as FrameworkModeTuple;

      classification = CallClassification.Unknown;
    }

    const signature = definition.createMethodSignature({
      packageName,
      typeName,
      methodName,
      methodParameters,
    });

    // For Java, we'll always get back a .jar file, and the library version may be bad because not all library authors
    // properly specify the version. Therefore, we'll always try to parse the name and version from the library filename
    // for Java.
    if (
      library.endsWith(".jar") ||
      libraryVersion === "" ||
      libraryVersion === undefined
    ) {
      const { name, version } = parseLibraryFilename(library);
      library = name;
      if (version) {
        libraryVersion = version;
      }
    }

    if (libraryVersion === "") {
      libraryVersion = undefined;
    }

    if (!methodsByApiName.has(signature)) {
      methodsByApiName.set(signature, {
        library,
        libraryVersion,
        signature,
        packageName,
        typeName,
        methodName,
        methodParameters,
        supported,
        supportedType: type,
        usages: [],
      });
    }

    if (usageEntityValue.url === undefined) {
      return;
    }

    const usageUrl = mapUrlValue(usageEntityValue.url);
    if (!usageUrl || !isUrlValueResolvable(usageUrl)) {
      return;
    }

    if (!usageEntityValue.label) {
      return;
    }

    const method = methodsByApiName.get(signature)!;
    const usages: Usage[] = [
      ...method.usages,
      {
        label: usageEntityValue.label,
        url: usageUrl,
        classification,
      },
    ];
    methodsByApiName.set(signature, {
      ...method,
      usages,
    });
  });

  return Array.from(methodsByApiName.values());
}
