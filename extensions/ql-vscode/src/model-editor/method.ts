import type { ModeledMethod, ModeledMethodType } from "./modeled-method";
import type { UrlValueResolvable } from "../common/raw-result-types";

type Call = {
  readonly label: string;
  readonly url: Readonly<UrlValueResolvable>;
};

export enum CallClassification {
  Unknown = "unknown",
  Source = "source",
  Test = "test",
  Generated = "generated",
}

export type Usage = Call & {
  readonly classification: CallClassification;
};

/**
 * Endpoint types are generic and can be used to represent different types of endpoints in different languages.
 *
 * For a reference of symbol kinds used in the LSP protocol (which is a good reference for widely supported features), see
 * https://github.com/microsoft/vscode-languageserver-node/blob/4c8115f40b52f2e13adab41109c5b1208fc155ab/types/src/main.ts#L2890-L2920
 */
export enum EndpointType {
  Module = "module",
  Class = "class",
  Method = "method",
  Constructor = "constructor",
  Function = "function",
  StaticMethod = "staticMethod",
  ClassMethod = "classMethod",
}

export interface MethodDefinition {
  readonly endpointType: EndpointType;
  /**
   * The package name in Java, or the namespace in C#, e.g. `org.sql2o` or `System.Net.Http.Headers`.
   *
   * If the class is not in a package, the value should be an empty string.
   */
  readonly packageName: string;
  readonly typeName: string;
  readonly methodName: string;
  /**
   * The method parameters, including enclosing parentheses, e.g. `(String, String)`
   */
  readonly methodParameters: string;
}

export interface MethodSignature extends MethodDefinition {
  /**
   * Contains the version of the library if it can be determined by CodeQL, e.g. `4.2.2.2`
   */
  readonly libraryVersion?: string;
  /**
   * A unique signature that can be used to identify this external API usage.
   *
   * The signature contains the package name, type name, method name, and method parameters
   * in the form "packageName.typeName#methodName(methodParameters)".
   * e.g. `org.sql2o.Connection#createQuery(String)`
   */
  readonly signature: string;
}

export interface Method extends MethodSignature {
  /**
   * Contains the name of the library containing the method declaration, e.g. `sql2o-1.6.0.jar` or `System.Runtime.dll`
   */
  readonly library: string;
  /**
   * Is this method already supported by CodeQL standard libraries.
   * If so, there is no need for the user to model it themselves.
   */
  readonly supported: boolean;
  readonly supportedType: ModeledMethodType;
  readonly usages: readonly Usage[];
}

export interface MethodArgument {
  path: string;
  label: string;
}

export function getArgumentsList(methodParameters: string): string[] {
  if (methodParameters === "()") {
    return [];
  }

  return methodParameters.substring(1, methodParameters.length - 1).split(",");
}

/**
 * Should we present the user with the ability to edit to modelings for this method.
 *
 * A method may be unmodelable if it is already modeled by CodeQL or by an extension
 * pack other than the one currently being edited.
 */
export function canMethodBeModeled(
  method: Method,
  modeledMethods: readonly ModeledMethod[],
  methodIsUnsaved: boolean,
): boolean {
  return (
    !method.supported ||
    modeledMethods.some((modeledMethod) => modeledMethod.type !== "none") ||
    methodIsUnsaved
  );
}
