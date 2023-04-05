import { ResolvableLocationValue } from "../pure/bqrs-cli-types";

export type Call = {
  label: string;
  url: ResolvableLocationValue;
};

export type ExternalApiUsage = {
  externalApiInfo: string;
  packageName: string;
  typeName: string;
  methodName: string;
  methodParameters: string;
  supported: boolean;
  usages: Call[];
};
