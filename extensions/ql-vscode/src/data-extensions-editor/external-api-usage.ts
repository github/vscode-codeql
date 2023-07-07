import { ResolvableLocationValue } from "../common/bqrs-cli-types";

export type Call = {
  label: string;
  url: ResolvableLocationValue;
};

export type ExternalApiUsage = {
  /**
   * Contains the name of the library containing the method declaration, e.g. `sql2o-1.6.0.jar` or `System.Runtime.dll`
   */
  library: string;
  /**
   * A unique signature that can be used to identify this external API usage.
   *
   * The signature contains the package name, type name, method name, and method parameters
   * in the form "packageName.typeName#methodName(methodParameters)".
   * e.g. `org.sql2o.Connection#createQuery(String)`
   */
  signature: string;
  packageName: string;
  typeName: string;
  methodName: string;
  /**
   * The method parameters, including enclosing parentheses, e.g. `(String, String)`
   */
  methodParameters: string;
  /**
   * Is this method already supported by CodeQL standard libraries.
   * If so, there is no need for the user to model it themselves.
   */
  supported: boolean;
  usages: Call[];
};
