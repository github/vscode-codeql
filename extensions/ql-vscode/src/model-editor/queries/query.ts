import type { CallClassification } from "../method";
import type { ModeledMethodType } from "../modeled-method";
import type { BqrsEntityValue } from "../../common/bqrs-cli-types";

export type Query = {
  /**
   * The application query.
   *
   * It should select all usages of external APIs, and return the following result pattern:
   * - usage: the usage of the external API. This is an entity.
   * - packageName: the package name of the external API. This is a string.
   * - typeName: the type name of the external API. This is a string.
   * - methodName: the method name of the external API. This is a string.
   * - methodParameters: the parameters of the external API. This is a string.
   * - supported: whether the external API is modeled. This is a boolean.
   * - libraryName: the name of the library that contains the external API. This is a string and usually the basename of a file.
   * - libraryVersion: the version of the library that contains the external API. This is a string and can be empty if the version cannot be determined.
   * - type: the modeled kind of the method, either "sink", "source", "summary", or "neutral"
   * - classification: the classification of the use of the method, either "source", "test", "generated", or "unknown"
   * - kind: the kind of the endpoint, language-specific, e.g. "method" or "function"
   */
  applicationModeQuery: string;
  /**
   * The framework query.
   *
   * It should select all methods that are callable by applications, which is usually all public methods (and constructors).
   * The result pattern should be as follows:
   * - method: the method that is callable by applications. This is an entity.
   * - packageName: the package name of the method. This is a string.
   * - typeName: the type name of the method. This is a string.
   * - methodName: the method name of the method. This is a string.
   * - methodParameters: the parameters of the method. This is a string.
   * - supported: whether this method is modeled. This should be a string representation of a boolean to satify the result pattern for a problem query.
   * - libraryName: the name of the file or library that contains the method. This is a string and usually the basename of a file.
   * - type: the modeled kind of the method, either "sink", "source", "summary", or "neutral"
   * - kind: the kind of the endpoint, language-specific, e.g. "method" or "function"
   */
  frameworkModeQuery: string;
  dependencies?: {
    [filename: string]: string;
  };
};

export type ApplicationModeTuple = [
  BqrsEntityValue,
  string,
  string,
  string,
  string,
  boolean,
  string,
  string,
  ModeledMethodType,
  CallClassification,
  string | BqrsEntityValue | undefined,
];

export type FrameworkModeTuple = [
  BqrsEntityValue,
  string,
  string,
  string,
  string,
  boolean,
  string,
  ModeledMethodType,
  string | BqrsEntityValue | undefined,
];
