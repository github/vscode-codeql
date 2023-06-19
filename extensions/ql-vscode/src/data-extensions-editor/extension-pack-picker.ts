import { join, relative, resolve, sep } from "path";
import { outputFile, pathExists, readFile } from "fs-extra";
import { dump as dumpYaml, load as loadYaml } from "js-yaml";
import { minimatch } from "minimatch";
import { CancellationToken, window, WorkspaceFolder } from "vscode";
import { CodeQLCliServer, QlpacksInfo } from "../codeql-cli/cli";
import {
  getOnDiskWorkspaceFolders,
  getOnDiskWorkspaceFoldersObjects,
} from "../common/vscode/workspace-folders";
import { ProgressCallback } from "../common/vscode/progress";
import { DatabaseItem } from "../databases/local-databases";
import { getQlPackPath, QLPACK_FILENAMES } from "../pure/ql";
import { getErrorMessage } from "../pure/helpers-pure";
import { ExtensionPack, ExtensionPackModelFile } from "./shared/extension-pack";
import { NotificationLogger, showAndLogErrorMessage } from "../common/logging";
import { containsPath } from "../pure/files";
import { disableAutoNameExtensionPack } from "../config";
import {
  autoNameExtensionPack,
  ExtensionPackName,
  formatPackName,
  parsePackName,
  validatePackName,
} from "./extension-pack-name";

const maxStep = 3;

export async function pickExtensionPackModelFile(
  cliServer: Pick<CodeQLCliServer, "resolveQlpacks" | "resolveExtensions">,
  databaseItem: Pick<DatabaseItem, "name" | "language">,
  logger: NotificationLogger,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<ExtensionPackModelFile | undefined> {
  const extensionPack = await pickExtensionPack(
    cliServer,
    databaseItem,
    logger,
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
  logger: NotificationLogger,
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

  if (!disableAutoNameExtensionPack()) {
    progress({
      message: "Creating extension pack...",
      step: 2,
      maxStep,
    });

    return autoCreateExtensionPack(
      databaseItem.name,
      databaseItem.language,
      extensionPacksInfo,
      logger,
    );
  }

  if (Object.keys(extensionPacksInfo).length === 0) {
    return pickNewExtensionPack(databaseItem, token);
  }

  const extensionPacks = (
    await Promise.all(
      Object.entries(extensionPacksInfo).map(async ([name, paths]) => {
        if (paths.length !== 1) {
          void showAndLogErrorMessage(
            logger,
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
          void showAndLogErrorMessage(
            logger,
            `Could not read extension pack ${name}`,
            {
              fullMessage: `Could not read extension pack ${name} at ${path}: ${getErrorMessage(
                e,
              )}`,
            },
          );

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
  const workspaceFolder = await askForWorkspaceFolder();
  if (!workspaceFolder) {
    return undefined;
  }

  const examplePackName = autoNameExtensionPack(
    databaseItem.name,
    databaseItem.language,
  );

  const name = await window.showInputBox(
    {
      title: "Create new extension pack",
      prompt: "Enter name of extension pack",
      placeHolder: examplePackName
        ? `e.g. ${formatPackName(examplePackName)}`
        : "",
      validateInput: async (value: string): Promise<string | undefined> => {
        const message = validatePackName(value);
        if (message) {
          return message;
        }

        const packName = parsePackName(value);
        if (!packName) {
          return "Invalid pack name";
        }

        const packPath = join(workspaceFolder.uri.fsPath, packName.name);
        if (await pathExists(packPath)) {
          return `A pack already exists at ${packPath}`;
        }

        return undefined;
      },
    },
    token,
  );
  if (!name) {
    return undefined;
  }

  const packName = parsePackName(name);
  if (!packName) {
    return undefined;
  }

  const packPath = join(workspaceFolder.uri.fsPath, packName.name);

  if (await pathExists(packPath)) {
    return undefined;
  }

  return writeExtensionPack(packPath, packName, databaseItem.language);
}

async function autoCreateExtensionPack(
  name: string,
  language: string,
  extensionPacksInfo: QlpacksInfo,
  logger: NotificationLogger,
): Promise<ExtensionPack | undefined> {
  // Choose a workspace folder to create the extension pack in
  const workspaceFolder = await autoPickWorkspaceFolder(language);
  if (!workspaceFolder) {
    return undefined;
  }

  // Generate the name of the extension pack
  const packName = autoNameExtensionPack(name, language);
  if (!packName) {
    void showAndLogErrorMessage(
      logger,
      `Could not automatically name extension pack for database ${name}`,
    );

    return undefined;
  }

  // Find any existing locations of this extension pack
  const existingExtensionPackPaths =
    extensionPacksInfo[formatPackName(packName)];

  // If there is already an extension pack with this name, use it if it is valid
  if (existingExtensionPackPaths?.length === 1) {
    let extensionPack: ExtensionPack;
    try {
      extensionPack = await readExtensionPack(existingExtensionPackPaths[0]);
    } catch (e: unknown) {
      void showAndLogErrorMessage(
        logger,
        `Could not read extension pack ${formatPackName(packName)}`,
        {
          fullMessage: `Could not read extension pack ${formatPackName(
            packName,
          )} at ${existingExtensionPackPaths[0]}: ${getErrorMessage(e)}`,
        },
      );

      return undefined;
    }

    return extensionPack;
  }

  // If there is already an existing extension pack with this name, but it resolves
  // to multiple paths, then we can't use it
  if (existingExtensionPackPaths?.length > 1) {
    void showAndLogErrorMessage(
      logger,
      `Extension pack ${formatPackName(packName)} resolves to multiple paths`,
      {
        fullMessage: `Extension pack ${formatPackName(
          packName,
        )} resolves to multiple paths: ${existingExtensionPackPaths.join(
          ", ",
        )}`,
      },
    );

    return undefined;
  }

  const packPath = join(workspaceFolder.uri.fsPath, packName.name);

  if (await pathExists(packPath)) {
    void showAndLogErrorMessage(
      logger,
      `Directory ${packPath} already exists for extension pack ${formatPackName(
        packName,
      )}`,
    );

    return undefined;
  }

  return writeExtensionPack(packPath, packName, language);
}

async function autoPickWorkspaceFolder(
  language: string,
): Promise<WorkspaceFolder | undefined> {
  const workspaceFolders = getOnDiskWorkspaceFoldersObjects();

  // If there's only 1 workspace folder, use that
  if (workspaceFolders.length === 1) {
    return workspaceFolders[0];
  }

  // In the vscode-codeql-starter repository, all workspace folders are named "codeql-custom-queries-<language>",
  // so we can use that to find the workspace folder for the language
  const starterWorkspaceFolderForLanguage = workspaceFolders.find(
    (folder) => folder.name === `codeql-custom-queries-${language}`,
  );
  if (starterWorkspaceFolderForLanguage) {
    return starterWorkspaceFolderForLanguage;
  }

  // Otherwise, try to find one that ends with "-<language>"
  const workspaceFolderForLanguage = workspaceFolders.find((folder) =>
    folder.name.endsWith(`-${language}`),
  );
  if (workspaceFolderForLanguage) {
    return workspaceFolderForLanguage;
  }

  // If we can't find one, just ask the user
  return askForWorkspaceFolder();
}

async function askForWorkspaceFolder(): Promise<WorkspaceFolder | undefined> {
  const workspaceFolders = getOnDiskWorkspaceFoldersObjects();
  const workspaceFolderOptions = workspaceFolders.map((folder) => ({
    label: folder.name,
    detail: folder.uri.fsPath,
    folder,
  }));

  // We're not using window.showWorkspaceFolderPick because that also includes the database source folders while
  // we only want to include on-disk workspace folders.
  const workspaceFolder = await window.showQuickPick(workspaceFolderOptions, {
    title: "Select workspace folder to create extension pack in",
  });
  if (!workspaceFolder) {
    return undefined;
  }

  return workspaceFolder.folder;
}

async function writeExtensionPack(
  packPath: string,
  packName: ExtensionPackName,
  language: string,
): Promise<ExtensionPack> {
  const packYamlPath = join(packPath, "codeql-pack.yml");

  const extensionPack: ExtensionPack = {
    path: packPath,
    yamlPath: packYamlPath,
    name: formatPackName(packName),
    version: "0.0.0",
    extensionTargets: {
      [`codeql/${language}-all`]: "*",
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

        if (!containsPath(extensionPack.path, path)) {
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
