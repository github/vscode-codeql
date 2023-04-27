export interface ExtensionPack {
  path: string;
  yamlPath: string;

  name: string;
  version: string;

  extensionTargets: Record<string, string>;
  dataExtensions: string[];
}

export interface ExtensionPackModelFile {
  filename: string;
  extensionPack: ExtensionPack;
}
