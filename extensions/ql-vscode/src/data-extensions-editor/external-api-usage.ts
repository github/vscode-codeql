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
   * Contains the full method signature, e.g. `org.sql2o.Connection#createQuery(String)`
   */
  signature: string;
  packageName: string;
  typeName: string;
  methodName: string;
  methodParameters: string;
  supported: boolean;
  usages: Call[];
};
