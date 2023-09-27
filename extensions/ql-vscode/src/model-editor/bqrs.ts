import { DecodedBqrsChunk } from "../common/bqrs-cli-types";
import { Call, CallClassification, Method } from "./method";
import { ModeledMethodType } from "./modeled-method";
import { parseLibraryFilename } from "./library";
import { Mode } from "./shared/mode";
import { ApplicationModeTuple, FrameworkModeTuple } from "./queries/query";

export function decodeBqrsToMethods(
  chunk: DecodedBqrsChunk,
  mode: Mode,
): Method[] {
  const methodsByApiName = new Map<string, Method>();

  chunk?.tuples.forEach((tuple) => {
    let usage: Call;
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
        usage,
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
        usage,
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

    if (!methodParameters.startsWith("(")) {
      // There's a difference in how the Java and C# queries return method parameters. In the C# query, the method
      // parameters are returned without parentheses. In the Java query, the method parameters are returned with
      // parentheses. Therefore, we'll just add them if we don't see them.
      methodParameters = `(${methodParameters})`;
    }

    const signature = `${packageName}.${typeName}#${methodName}${methodParameters}`;

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

    const method = methodsByApiName.get(signature)!;
    method.usages.push({
      ...usage,
      classification,
    });
  });

  return Array.from(methodsByApiName.values());
}
