export interface ExtensionPack {
  path: string;
  yamlPath: string;

  name: string;
  version: string;
  language: string;

  extensionTargets: Record<string, string>;
  dataExtensions: string[];
}
