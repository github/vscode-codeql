import { outputFile } from "fs-extra";
import type { Method } from "./method";
import type { ModeledMethod } from "./modeled-method";
import type { Mode } from "./shared/mode";
import {
  createDataExtensionFiles,
  ExtensionFormat,
  loadDataExtension,
} from "./extension-serialization";
import { join, relative } from "path";
import type { ExtensionPack } from "./shared/extension-pack";
import type { NotificationLogger } from "../common/logging";
import { showAndLogErrorMessage } from "../common/logging";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import { pathsEqual } from "../common/files";
import type { QueryLanguage } from "../common/query-language";

export const DEFAULT_EXTENSION_FORMAT_FOR_NEW_FILES = ExtensionFormat.Yaml;
export const GENERATED_MODELS_EXTENSIONLESS_SUFFIX = ".model.generated";
const GENERATED_MODELS_SUFFIXES = [
  `${GENERATED_MODELS_EXTENSIONLESS_SUFFIX}.yml`,
  `${GENERATED_MODELS_EXTENSIONLESS_SUFFIX}.json`,
];

export async function saveModeledMethods(
  extensionPack: ExtensionPack,
  language: QueryLanguage,
  methods: readonly Method[],
  modeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
  mode: Mode,
  cliServer: CodeQLCliServer,
  logger: NotificationLogger,
): Promise<void> {
  const existingModeledMethods = await loadModeledMethodFiles(
    extensionPack,
    language,
    cliServer,
    logger,
  );

  const extensionFiles = createDataExtensionFiles(
    language,
    methods,
    modeledMethods,
    existingModeledMethods,
    mode,
    DEFAULT_EXTENSION_FORMAT_FOR_NEW_FILES,
  );

  for (const [filename, contents] of Object.entries(extensionFiles)) {
    await outputFile(join(extensionPack.path, filename), contents);
  }

  void logger.log(`Saved data extension files`);
}

async function loadModeledMethodFiles(
  extensionPack: ExtensionPack,
  language: QueryLanguage,
  cliServer: CodeQLCliServer,
  logger: NotificationLogger,
): Promise<Record<string, Record<string, readonly ModeledMethod[]>>> {
  const modelFiles = await listModelFiles(extensionPack.path, cliServer);

  const modeledMethodsByFile: Record<
    string,
    Record<string, ModeledMethod[]>
  > = {};

  for (const modelFile of modelFiles) {
    const modeledMethods = await loadDataExtension(
      extensionPack.path,
      modelFile,
      language,
    );
    if (!modeledMethods) {
      void showAndLogErrorMessage(
        logger,
        `Failed to parse data extension file ${modelFile}.`,
      );
      continue;
    }
    modeledMethodsByFile[modelFile] = modeledMethods;
  }

  return modeledMethodsByFile;
}

export async function loadModeledMethods(
  extensionPack: ExtensionPack,
  language: QueryLanguage,
  cliServer: CodeQLCliServer,
  logger: NotificationLogger,
): Promise<Record<string, ModeledMethod[]>> {
  const existingModeledMethods: Record<string, ModeledMethod[]> = {};

  const modeledMethodsByFile = await loadModeledMethodFiles(
    extensionPack,
    language,
    cliServer,
    logger,
  );
  for (const modeledMethods of Object.values(modeledMethodsByFile)) {
    for (const [key, value] of Object.entries(modeledMethods)) {
      if (!(key in existingModeledMethods)) {
        existingModeledMethods[key] = [];
      }

      existingModeledMethods[key].push(...value);
    }
  }

  return existingModeledMethods;
}

function isGeneratedExtension(filename: string): boolean {
  return GENERATED_MODELS_SUFFIXES.some((suffix) => filename.endsWith(suffix));
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
        // We never load generated models
        if (isGeneratedExtension(extension.file)) {
          continue;
        }

        modelFiles.add(relative(extensionPackPath, extension.file));
      }
    }
  }
  return modelFiles;
}
