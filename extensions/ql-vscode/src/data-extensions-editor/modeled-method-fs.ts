import { outputFile, readFile } from "fs-extra";
import { ExternalApiUsage } from "./external-api-usage";
import { ModeledMethod } from "./modeled-method";
import { Mode } from "./shared/mode";
import { createDataExtensionYamls, loadDataExtensionYaml } from "./yaml";
import { join } from "path";
import { ExtensionPack } from "./shared/extension-pack";
import {
  Logger,
  NotificationLogger,
  showAndLogErrorMessage,
} from "../common/logging";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { load as loadYaml } from "js-yaml";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { pathsEqual } from "../common/files";

export async function saveModeledMethods(
  extensionPack: ExtensionPack,
  databaseName: string,
  language: string,
  externalApiUsages: ExternalApiUsage[],
  modeledMethods: Record<string, ModeledMethod>,
  mode: Mode,
  logger: Logger,
): Promise<void> {
  const yamls = createDataExtensionYamls(
    databaseName,
    language,
    externalApiUsages,
    modeledMethods,
    mode,
  );

  for (const [filename, yaml] of Object.entries(yamls)) {
    await outputFile(join(extensionPack.path, filename), yaml);
  }

  void logger.log(`Saved data extension YAML`);
}

export async function loadModeledMethods(
  extensionPack: ExtensionPack,
  cliServer: CodeQLCliServer,
  logger: NotificationLogger,
): Promise<Record<string, ModeledMethod>> {
  const modelFiles = await listModelFiles(extensionPack.path, cliServer);

  const existingModeledMethods: Record<string, ModeledMethod> = {};

  for (const modelFile of modelFiles) {
    const yaml = await readFile(modelFile, "utf8");

    const data = loadYaml(yaml, {
      filename: modelFile,
    });

    const modeledMethods = loadDataExtensionYaml(data);
    if (!modeledMethods) {
      void showAndLogErrorMessage(
        logger,
        `Failed to parse data extension YAML ${modelFile}.`,
      );
      continue;
    }

    for (const [key, value] of Object.entries(modeledMethods)) {
      existingModeledMethods[key] = value;
    }
  }

  return existingModeledMethods;
}

export async function listModelFiles(
  extensionPackPath: string,
  cliServer: CodeQLCliServer,
): Promise<Set<string>> {
  const result = await cliServer.resolveExtensions(
    extensionPackPath,
    getOnDiskWorkspaceFolders(),
  );

  const modelFiles = new Set<string>();
  for (const [path, extensions] of Object.entries(result.data)) {
    if (pathsEqual(path, extensionPackPath)) {
      for (const extension of extensions) {
        modelFiles.add(extension.file);
      }
    }
  }
  return modelFiles;
}
