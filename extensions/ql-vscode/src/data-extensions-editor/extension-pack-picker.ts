import { relative, resolve, sep } from "path";
import { pathExists, readFile } from "fs-extra";
import { load as loadYaml } from "js-yaml";
import { minimatch } from "minimatch";
import { CancellationToken, window } from "vscode";
import { CodeQLCliServer } from "../cli";
import { getOnDiskWorkspaceFolders, showAndLogErrorMessage } from "../helpers";
import { ProgressCallback } from "../progress";
import { DatabaseItem } from "../local-databases";
import { getQlPackPath, QLPACK_FILENAMES } from "../pure/ql";

const maxStep = 3;

export async function pickExtensionPackModelFile(
  cliServer: Pick<CodeQLCliServer, "resolveQlpacks" | "resolveExtensions">,
  databaseItem: Pick<DatabaseItem, "name">,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<string | undefined> {
  const extensionPackPath = await pickExtensionPack(cliServer, progress, token);
  if (!extensionPackPath) {
    return;
  }

  const modelFile = await pickModelFile(
    cliServer,
    databaseItem,
    extensionPackPath,
    progress,
    token,
  );
  if (!modelFile) {
    return;
  }

  return modelFile;
}

async function pickExtensionPack(
  cliServer: Pick<CodeQLCliServer, "resolveQlpacks">,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<string | undefined> {
  progress({
    message: "Resolving extension packs...",
    step: 1,
    maxStep,
  });

  // Get all existing extension packs in the workspace
  const additionalPacks = getOnDiskWorkspaceFolders();
  const extensionPacks = await cliServer.resolveQlpacks(additionalPacks, true);
  const options = Object.keys(extensionPacks).map((pack) => ({
    label: pack,
    extensionPack: pack,
  }));

  progress({
    message: "Choosing extension pack...",
    step: 2,
    maxStep,
  });

  const extensionPackOption = await window.showQuickPick(
    options,
    {
      title: "Select extension pack to use",
    },
    token,
  );
  if (!extensionPackOption) {
    return undefined;
  }

  const extensionPackPaths = extensionPacks[extensionPackOption.extensionPack];
  if (extensionPackPaths.length !== 1) {
    void showAndLogErrorMessage(
      `Extension pack ${extensionPackOption.extensionPack} could not be resolved to a single location`,
      {
        fullMessage: `Extension pack ${
          extensionPackOption.extensionPack
        } could not be resolved to a single location. Found ${
          extensionPackPaths.length
        } locations: ${extensionPackPaths.join(", ")}.`,
      },
    );
    return undefined;
  }

  return extensionPackPaths[0];
}

async function pickModelFile(
  cliServer: Pick<CodeQLCliServer, "resolveExtensions">,
  databaseItem: Pick<DatabaseItem, "name">,
  extensionPackPath: string,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<string | undefined> {
  // Find the existing model files in the extension pack
  const additionalPacks = getOnDiskWorkspaceFolders();
  const extensions = await cliServer.resolveExtensions(
    extensionPackPath,
    additionalPacks,
  );

  const modelFiles = new Set<string>();

  if (extensionPackPath in extensions.data) {
    for (const extension of extensions.data[extensionPackPath]) {
      modelFiles.add(extension.file);
    }
  }

  if (modelFiles.size === 0) {
    return pickNewModelFile(databaseItem, extensionPackPath, token);
  }

  const fileOptions: Array<{ label: string; file: string | null }> = [];
  for (const file of modelFiles) {
    fileOptions.push({
      label: relative(extensionPackPath, file).replaceAll(sep, "/"),
      file,
    });
  }
  fileOptions.push({
    label: "Create new model file",
    file: null,
  });

  progress({
    message: "Choosing model file...",
    step: 3,
    maxStep,
  });

  const fileOption = await window.showQuickPick(
    fileOptions,
    {
      title: "Select model file to use",
    },
    token,
  );

  if (!fileOption) {
    return undefined;
  }

  if (fileOption.file) {
    return fileOption.file;
  }

  return pickNewModelFile(databaseItem, extensionPackPath, token);
}

async function pickNewModelFile(
  databaseItem: Pick<DatabaseItem, "name">,
  extensionPackPath: string,
  token: CancellationToken,
) {
  const qlpackPath = await getQlPackPath(extensionPackPath);
  if (!qlpackPath) {
    void showAndLogErrorMessage(
      `Could not find any of ${QLPACK_FILENAMES.join(
        ", ",
      )} in ${extensionPackPath}`,
    );
    return undefined;
  }

  const qlpack = await loadYaml(await readFile(qlpackPath, "utf8"), {
    filename: qlpackPath,
  });
  if (typeof qlpack !== "object" || qlpack === null) {
    void showAndLogErrorMessage(`Could not parse ${qlpackPath}`);
    return undefined;
  }

  const dataExtensionPatternsValue = qlpack.dataExtensions;
  if (
    !(
      Array.isArray(dataExtensionPatternsValue) ||
      typeof dataExtensionPatternsValue === "string"
    )
  ) {
    void showAndLogErrorMessage(
      `Expected 'dataExtensions' to be a string or an array in ${qlpackPath}`,
    );
    return undefined;
  }

  // The YAML allows either a string or an array of strings
  const dataExtensionPatterns = Array.isArray(dataExtensionPatternsValue)
    ? dataExtensionPatternsValue
    : [dataExtensionPatternsValue];

  const filename = await window.showInputBox(
    {
      title: "Enter the name of the new model file",
      value: `models/${databaseItem.name.replaceAll("/", ".")}.model.yml`,
      validateInput: async (value: string): Promise<string | undefined> => {
        if (value === "") {
          return "File name must not be empty";
        }

        const path = resolve(extensionPackPath, value);

        if (await pathExists(path)) {
          return "File already exists";
        }

        const notInExtensionPack = relative(extensionPackPath, path).startsWith(
          "..",
        );
        if (notInExtensionPack) {
          return "File must be in the extension pack";
        }

        const matchesPattern = dataExtensionPatterns.some((pattern) =>
          minimatch(value, pattern, { matchBase: true }),
        );
        if (!matchesPattern) {
          return `File must match one of the patterns in 'dataExtensions' in ${qlpackPath}`;
        }

        return undefined;
      },
    },
    token,
  );
  if (!filename) {
    return undefined;
  }

  return resolve(extensionPackPath, filename);
}
