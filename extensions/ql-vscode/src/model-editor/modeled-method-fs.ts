import { outputFile, readFile } from "fs-extra";
import { Method } from "./method";
import { ModeledMethod } from "./modeled-method";
import { Mode } from "./shared/mode";
import { createDataExtensionYamls, loadDataExtensionYaml } from "./yaml";
import { join, relative } from "path";
import { ExtensionPack } from "./shared/extension-pack";
import { NotificationLogger, showAndLogErrorMessage } from "../common/logging";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { load as loadYaml } from "js-yaml";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { pathsEqual } from "../common/files";

export async function saveModeledMethods(
  extensionPack: ExtensionPack,
  language: string,
  methods: Method[],
  modeledMethods: Record<string, ModeledMethod>,
  mode: Mode,
  cliServer: CodeQLCliServer,
  logger: NotificationLogger,
): Promise<void> {
  const existingModeledMethods = await loadModeledMethodFiles(
    extensionPack,
    cliServer,
    logger,
  );

  const yamls = createDataExtensionYamls(
    language,
    methods,
    modeledMethods,
    existingModeledMethods,
    mode,
  );

  for (const [filename, yaml] of Object.entries(yamls)) {
    await outputFile(join(extensionPack.path, filename), yaml);
  }

  void logger.log(`Saved data extension YAML`);
}

async function loadModeledMethodFiles(
  extensionPack: ExtensionPack,
  cliServer: CodeQLCliServer,
  logger: NotificationLogger,
): Promise<Record<string, Record<string, ModeledMethod>>> {
  const modelFiles = await listModelFiles(extensionPack.path, cliServer);

  const modeledMethodsByFile: Record<
    string,
    Record<string, ModeledMethod>
  > = {};

  for (const modelFile of modelFiles) {
    const yaml = await readFile(join(extensionPack.path, modelFile), "utf8");

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
    modeledMethodsByFile[modelFile] = modeledMethods;
  }

  return modeledMethodsByFile;
}

export async function loadModeledMethods(
  extensionPack: ExtensionPack,
  cliServer: CodeQLCliServer,
  logger: NotificationLogger,
): Promise<Record<string, ModeledMethod>> {
  const existingModeledMethods: Record<string, ModeledMethod> = {};

  const modeledMethodsByFile = await loadModeledMethodFiles(
    extensionPack,
    cliServer,
    logger,
  );
  for (const modeledMethods of Object.values(modeledMethodsByFile)) {
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
        modelFiles.add(relative(extensionPackPath, extension.file));
      }
    }
  }
  return modelFiles;
}
