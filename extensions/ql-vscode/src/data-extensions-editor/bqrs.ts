import { DecodedBqrsChunk } from "../common/bqrs-cli-types";
import {
  Call,
  CallClassification,
  ExternalApiUsage,
} from "./external-api-usage";
import { ModeledMethodType } from "./modeled-method";

export function decodeBqrsToExternalApiUsages(
  chunk: DecodedBqrsChunk,
): ExternalApiUsage[] {
  const methodsByApiName = new Map<string, ExternalApiUsage>();

  chunk?.tuples.forEach((tuple) => {
    const usage = tuple[0] as Call;
    const signature = tuple[1] as string;
    const supported = (tuple[2] as string) === "true";
    const library = tuple[4] as string;
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

    if (!methodsByApiName.has(signature)) {
      methodsByApiName.set(signature, {
        library,
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
