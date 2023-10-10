import { ResolvableLocationValue } from "../common/bqrs-cli-types";
import { ModeledMethod, ModeledMethodType } from "./modeled-method";

export type Call = {
  label: string;
  url: ResolvableLocationValue;
};

export enum CallClassification {
  Unknown = "unknown",
  Source = "source",
  Test = "test",
  Generated = "generated",
}

export type Usage = Call & {
  classification: CallClassification;
};

export interface MethodSignature {
  /**
   * Contains the version of the library if it can be determined by CodeQL, e.g. `4.2.2.2`
   */
  libraryVersion?: string;
  /**
   * A unique signature that can be used to identify this external API usage.
   *
   * The signature contains the package name, type name, method name, and method parameters
   * in the form "packageName.typeName#methodName(methodParameters)".
   * e.g. `org.sql2o.Connection#createQuery(String)`
   */
  signature: string;
  /**
   * The package name in Java, or the namespace in C#, e.g. `org.sql2o` or `System.Net.Http.Headers`.
   *
   * If the class is not in a package, the value should be an empty string.
   */
  packageName: string;
  typeName: string;
  methodName: string;
  /**
   * The method parameters, including enclosing parentheses, e.g. `(String, String)`
   */
  methodParameters: string;
}

export interface Method extends MethodSignature {
  /**
   * Contains the name of the library containing the method declaration, e.g. `sql2o-1.6.0.jar` or `System.Runtime.dll`
   */
  library: string;
  /**
   * Is this method already supported by CodeQL standard libraries.
   * If so, there is no need for the user to model it themselves.
   */
  supported: boolean;
  supportedType: ModeledMethodType;
  usages: Usage[];
}

export function getArgumentsList(methodParameters: string): string[] {
  if (methodParameters === "()") {
    return [];
  }

  return methodParameters.substring(1, methodParameters.length - 1).split(",");
}

export function canMethodBeModeled(
  method: Method,
  modeledMethod: ModeledMethod | undefined,
  methodIsUnsaved: boolean,
): boolean {
  return (
    !method.supported ||
    (modeledMethod && modeledMethod?.type !== "none") ||
    methodIsUnsaved
  );
}
