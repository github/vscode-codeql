import { DecodedBqrsChunk } from "../common/bqrs-cli-types";
import { Call, CallClassification, Method } from "./method";
import { ModeledMethodType } from "./modeled-method";
import { parseLibraryFilename } from "./library";

export function decodeBqrsToExternalApiUsages(
  chunk: DecodedBqrsChunk,
): Method[] {
  const methodsByApiName = new Map<string, Method>();

  chunk?.tuples.forEach((tuple) => {
    const usage = tuple[0] as Call;
    const signature = tuple[1] as string;
    const supported = (tuple[2] as string) === "true";
    let library = tuple[4] as string;
    let libraryVersion: string | undefined = tuple[5] as string;
    const type = tuple[6] as ModeledMethodType;
    const classification = tuple[8] as CallClassification;

    const [packageWithType, methodDeclaration] = signature.split("#");

    const packageName = packageWithType.substring(
      0,
      packageWithType.lastIndexOf("."),
    );
    const typeName = packageWithType.substring(
      packageWithType.lastIndexOf(".") + 1,
    );

    const methodName = methodDeclaration.substring(
      0,
      methodDeclaration.indexOf("("),
    );
    const methodParameters = methodDeclaration.substring(
      methodDeclaration.indexOf("("),
    );

    // For Java, we'll always get back a .jar file, and the library version may be bad because not all library authors
    // properly specify the version. Therefore, we'll always try to parse the name and version from the library filename
    // for Java.
    if (library.endsWith(".jar") || libraryVersion === "") {
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
