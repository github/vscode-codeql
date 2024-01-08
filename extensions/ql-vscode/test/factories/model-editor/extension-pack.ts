import type { ExtensionPack } from "../../../src/model-editor/shared/extension-pack";
import { join } from "path";

export function createMockExtensionPack({
  path = "/path/to/extension-pack",
  ...data
}: Partial<ExtensionPack> = {}): ExtensionPack {
  return {
    path,
    yamlPath: join(path, "codeql-pack.yml"),
    name: "sql2o",
    version: "0.0.0",
    language: "java",
    extensionTargets: {
      "codeql/java-all": "*",
    },
    dataExtensions: ["models/**/*.yml"],
    ...data,
  };
}
