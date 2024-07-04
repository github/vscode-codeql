import type {
  DecodedBqrsChunk,
  BqrsEntityValue,
} from "../common/bqrs-cli-types";
import type { Method, Usage } from "./method";
import { EndpointType, CallClassification } from "./method";
import type { ModeledMethodType } from "./modeled-method";
import { parseLibraryFilename } from "./library";
import { Mode } from "./shared/mode";
import type { ApplicationModeTuple, FrameworkModeTuple } from "./queries/query";
import type { QueryLanguage } from "../common/query-language";
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
    let endpointKindColumn: string | BqrsEntityValue | undefined;
    let endpointType: EndpointType | undefined = undefined;

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
        endpointKindColumn,
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
        endpointKindColumn,
      ] = tuple as FrameworkModeTuple;

      classification = CallClassification.Unknown;
    }

    if ((type as string) === "") {
      type = "none";
    }

    if (definition.endpointTypeForEndpoint) {
      endpointType = definition.endpointTypeForEndpoint(
        {
          endpointType,
          packageName,
          typeName,
          methodName,
          methodParameters,
        },
        typeof endpointKindColumn === "object"
          ? endpointKindColumn.label
          : endpointKindColumn,
      );
    }

    if (endpointType === undefined) {
      endpointType =
        methodName === "" ? EndpointType.Class : EndpointType.Method;
    }

    const signature = definition.createMethodSignature({
      endpointType,
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
        endpointType,
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
