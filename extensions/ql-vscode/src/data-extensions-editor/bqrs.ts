import { DecodedBqrsChunk } from "../pure/bqrs-cli-types";
import { Call, ExternalApiUsage } from "./external-api-usage";

export function decodeBqrsToExternalApiUsages(
  chunk: DecodedBqrsChunk,
): ExternalApiUsage[] {
  const methodsByApiName = new Map<string, ExternalApiUsage>();

  chunk?.tuples.forEach((tuple) => {
    const usage = tuple[0] as Call;
    const signature = tuple[1] as string;
    const supported = (tuple[2] as string) === "true";
    const library = tuple[4] as string;

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

    if (!methodsByApiName.has(signature)) {
      methodsByApiName.set(signature, {
        library,
        signature,
        packageName,
        typeName,
        methodName,
        methodParameters,
        supported,
        usages: [],
      });
    }

    const method = methodsByApiName.get(signature)!;
    method.usages.push(usage);
  });

  const externalApiUsages = Array.from(methodsByApiName.values());
  externalApiUsages.sort((a, b) => {
    // Sort first by supported, putting unmodeled methods first.
    if (a.supported && !b.supported) {
      return 1;
    }
    if (!a.supported && b.supported) {
      return -1;
    }
    // Then sort by number of usages descending
    return b.usages.length - a.usages.length;
  });
  return externalApiUsages;
}
