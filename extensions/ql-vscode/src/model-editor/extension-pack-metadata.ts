export type ExtensionPackMetadata = {
  name: string;
  version: string;
  dataExtensions: string | string[];
  extensionTargets: Record<string, string>;
};
