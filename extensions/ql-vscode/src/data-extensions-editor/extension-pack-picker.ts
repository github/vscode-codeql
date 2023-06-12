import { join, relative, resolve, sep } from "path";
import { outputFile, pathExists, readFile } from "fs-extra";
import { dump as dumpYaml, load as loadYaml } from "js-yaml";
import { minimatch } from "minimatch";
import { CancellationToken, window } from "vscode";
import { CodeQLCliServer } from "../codeql-cli/cli";
import {
  getOnDiskWorkspaceFolders,
  getOnDiskWorkspaceFoldersObjects,
} from "../common/vscode/workspace-folders";
import { ProgressCallback } from "../common/vscode/progress";
import { DatabaseItem } from "../databases/local-databases";
import { getQlPackPath, QLPACK_FILENAMES } from "../pure/ql";
import { getErrorMessage } from "../pure/helpers-pure";
import { ExtensionPack, ExtensionPackModelFile } from "./shared/extension-pack";
import { showAndLogErrorMessage } from "../common/vscode/log";

const maxStep = 3;

const packNamePartRegex = /[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;
const packNameRegex = new RegExp(
  `^(?<scope>${packNamePartRegex.source})/(?<name>${packNamePartRegex.source})$`,
);
const packNameLength = 128;

export async function pickExtensionPackModelFile(
  cliServer: Pick<CodeQLCliServer, "resolveQlpacks" | "resolveExtensions">,
  databaseItem: Pick<DatabaseItem, "name" | "language">,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<ExtensionPackModelFile | undefined> {
  const extensionPack = await pickExtensionPack(
    cliServer,
    databaseItem,
    progress,
    token,
  );
  if (!extensionPack) {
    return undefined;
  }

  const modelFile = await pickModelFile(
    cliServer,
    databaseItem,
    extensionPack,
    progress,
    token,
  );
  if (!modelFile) {
    return;
  }

  return {
    filename: modelFile,
    extensionPack,
  };
}

async function pickExtensionPack(
  cliServer: Pick<CodeQLCliServer, "resolveQlpacks">,
  databaseItem: Pick<DatabaseItem, "name" | "language">,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<ExtensionPack | undefined> {
  progress({
    message: "Resolving extension packs...",
    step: 1,
    maxStep,
  });

  // Get all existing extension packs in the workspace
  const additionalPacks = getOnDiskWorkspaceFolders();
  const extensionPacksInfo = await cliServer.resolveQlpacks(
    additionalPacks,
    true,
  );

  if (Object.keys(extensionPacksInfo).length === 0) {
    return pickNewExtensionPack(databaseItem, token);
  }

  const extensionPacks = (
    await Promise.all(
      Object.entries(extensionPacksInfo).map(async ([name, paths]) => {
        if (paths.length !== 1) {
          void showAndLogErrorMessage(
            `Extension pack ${name} resolves to multiple paths`,
            {
              fullMessage: `Extension pack ${name} resolves to multiple paths: ${paths.join(
                ", ",
              )}`,
            },
          );

          return undefined;
        }

        const path = paths[0];

        let extensionPack: ExtensionPack;
        try {
          extensionPack = await readExtensionPack(path);
        } catch (e: unknown) {
          void showAndLogErrorMessage(`Could not read extension pack ${name}`, {
            fullMessage: `Could not read extension pack ${name} at ${path}: ${getErrorMessage(
              e,
            )}`,
          });

          return undefined;
        }

        return extensionPack;
      }),
    )
  ).filter((info): info is ExtensionPack => info !== undefined);

  const extensionPacksForLanguage = extensionPacks.filter(
    (pack) =>
      pack.extensionTargets[`codeql/${databaseItem.language}-all`] !==
      undefined,
  );

  const options: Array<{
    label: string;
    description: string | undefined;
    detail: string | undefined;
    extensionPack: ExtensionPack | null;
  }> = extensionPacksForLanguage.map((pack) => ({
    label: pack.name,
    description: pack.version,
    detail: pack.path,
    extensionPack: pack,
  }));
  options.push({
    label: "Create new extension pack",
    description: undefined,
    detail: undefined,
    extensionPack: null,
  });

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

  if (!extensionPackOption.extensionPack) {
    return pickNewExtensionPack(databaseItem, token);
  }

  return extensionPackOption.extensionPack;
}

async function pickModelFile(
  cliServer: Pick<CodeQLCliServer, "resolveExtensions">,
  databaseItem: Pick<DatabaseItem, "name">,
  extensionPack: ExtensionPack,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<string | undefined> {
  // Find the existing model files in the extension pack
  const additionalPacks = getOnDiskWorkspaceFolders();
  const extensions = await cliServer.resolveExtensions(
    extensionPack.path,
    additionalPacks,
  );

  const modelFiles = new Set<string>();

  if (extensionPack.path in extensions.data) {
    for (const extension of extensions.data[extensionPack.path]) {
      modelFiles.add(extension.file);
    }
  }

  if (modelFiles.size === 0) {
    return pickNewModelFile(databaseItem, extensionPack, token);
  }

  const fileOptions: Array<{ label: string; file: string | null }> = [];
  for (const file of modelFiles) {
    fileOptions.push({
      label: relative(extensionPack.path, file).replaceAll(sep, "/"),
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

  return pickNewModelFile(databaseItem, extensionPack, token);
}

async function pickNewExtensionPack(
  databaseItem: Pick<DatabaseItem, "name" | "language">,
  token: CancellationToken,
): Promise<ExtensionPack | undefined> {
  const workspaceFolders = getOnDiskWorkspaceFoldersObjects();
  const workspaceFolderOptions = workspaceFolders.map((folder) => ({
    label: folder.name,
    detail: folder.uri.fsPath,
    path: folder.uri.fsPath,
  }));

  // We're not using window.showWorkspaceFolderPick because that also includes the database source folders while
  // we only want to include on-disk workspace folders.
  const workspaceFolder = await window.showQuickPick(workspaceFolderOptions, {
    title: "Select workspace folder to create extension pack in",
  });
  if (!workspaceFolder) {
    return undefined;
  }

  let examplePackName = `${databaseItem.name}-extensions`;
  if (!examplePackName.includes("/")) {
    examplePackName = `pack/${examplePackName}`;
  }

  const packName = await window.showInputBox(
    {
      title: "Create new extension pack",
      prompt: "Enter name of extension pack",
      placeHolder: `e.g. ${examplePackName}`,
      validateInput: async (value: string): Promise<string | undefined> => {
        if (!value) {
          return "Pack name must not be empty";
        }

        if (value.length > packNameLength) {
          return `Pack name must be no longer than ${packNameLength} characters`;
        }

        const matches = packNameRegex.exec(value);
        if (!matches?.groups) {
          if (!value.includes("/")) {
            return "Invalid package name: a pack name must contain a slash to separate the scope from the pack name";
          }

          return "Invalid package name: a pack name must contain only lowercase ASCII letters, ASCII digits, and hyphens";
        }

        const packPath = join(workspaceFolder.path, matches.groups.name);
        if (await pathExists(packPath)) {
          return `A pack already exists at ${packPath}`;
        }

        return undefined;
      },
    },
    token,
  );
  if (!packName) {
    return undefined;
  }

  const matches = packNameRegex.exec(packName);
  if (!matches?.groups) {
    return;
  }

  const name = matches.groups.name;
  const packPath = join(workspaceFolder.path, name);

  if (await pathExists(packPath)) {
    return undefined;
  }

  const packYamlPath = join(packPath, "codeql-pack.yml");

  const extensionPack: ExtensionPack = {
    path: packPath,
    yamlPath: packYamlPath,
    name: packName,
    version: "0.0.0",
    extensionTargets: {
      [`codeql/${databaseItem.language}-all`]: "*",
    },
    dataExtensions: ["models/**/*.yml"],
  };

  await outputFile(
    packYamlPath,
    dumpYaml({
      name: extensionPack.name,
      version: extensionPack.version,
      library: true,
      extensionTargets: extensionPack.extensionTargets,
      dataExtensions: extensionPack.dataExtensions,
    }),
  );

  return extensionPack;
}

async function pickNewModelFile(
  databaseItem: Pick<DatabaseItem, "name">,
  extensionPack: ExtensionPack,
  token: CancellationToken,
) {
  const filename = await window.showInputBox(
    {
      title: "Enter the name of the new model file",
      value: `models/${databaseItem.name.replaceAll("/", ".")}.model.yml`,
      validateInput: async (value: string): Promise<string | undefined> => {
        if (value === "") {
          return "File name must not be empty";
        }

        const path = resolve(extensionPack.path, value);

        if (await pathExists(path)) {
          return "File already exists";
        }

        const notInExtensionPack = relative(
          extensionPack.path,
          path,
        ).startsWith("..");
        if (notInExtensionPack) {
          return "File must be in the extension pack";
        }

        const matchesPattern = extensionPack.dataExtensions.some((pattern) =>
          minimatch(value, pattern, { matchBase: true }),
        );
        if (!matchesPattern) {
          return `File must match one of the patterns in 'dataExtensions' in ${extensionPack.yamlPath}`;
        }

        return undefined;
      },
    },
    token,
  );
  if (!filename) {
    return undefined;
  }

  return resolve(extensionPack.path, filename);
}

async function readExtensionPack(path: string): Promise<ExtensionPack> {
  const qlpackPath = await getQlPackPath(path);
  if (!qlpackPath) {
    throw new Error(
      `Could not find any of ${QLPACK_FILENAMES.join(", ")} in ${path}`,
    );
  }

  const qlpack = await loadYaml(await readFile(qlpackPath, "utf8"), {
    filename: qlpackPath,
  });
  if (typeof qlpack !== "object" || qlpack === null) {
    throw new Error(`Could not parse ${qlpackPath}`);
  }

  const dataExtensionValue = qlpack.dataExtensions;
  if (
    !(
      Array.isArray(dataExtensionValue) ||
      typeof dataExtensionValue === "string"
    )
  ) {
    throw new Error(
      `Expected 'dataExtensions' to be a string or an array in ${qlpackPath}`,
    );
  }

  // The YAML allows either a string or an array of strings
  const dataExtensions = Array.isArray(dataExtensionValue)
    ? dataExtensionValue
    : [dataExtensionValue];

  return {
    path,
    yamlPath: qlpackPath,
    name: qlpack.name,
    version: qlpack.version,
    extensionTargets: qlpack.extensionTargets,
    dataExtensions,
  };
}
