import { ResolvableLocationValue } from "../pure/bqrs-cli-types";

export type Call = {
  label: string;
  url: ResolvableLocationValue;
};

export type ExternalApiUsage = {
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
