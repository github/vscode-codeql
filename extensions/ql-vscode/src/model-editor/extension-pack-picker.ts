import { join } from "path";
import { outputFile, pathExists, readFile } from "fs-extra";
import { dump as dumpYaml, load as loadYaml } from "js-yaml";
import { Uri } from "vscode";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { ProgressCallback } from "../common/vscode/progress";
import { DatabaseItem } from "../databases/local-databases";
import { getQlPackPath, QLPACK_FILENAMES } from "../common/ql";
import { getErrorMessage } from "../common/helpers-pure";
import { ExtensionPack } from "./shared/extension-pack";
import { NotificationLogger, showAndLogErrorMessage } from "../common/logging";
import { getExtensionsDirectory } from "../config";
import {
  autoNameExtensionPack,
  ExtensionPackName,
  formatPackName,
} from "./extension-pack-name";
import { autoPickExtensionsDirectory } from "./extensions-workspace-folder";

export async function pickExtensionPack(
  cliServer: Pick<CodeQLCliServer, "resolveQlpacks">,
  databaseItem: Pick<DatabaseItem, "name" | "language">,
  logger: NotificationLogger,
  progress: ProgressCallback,
  maxStep: number,
): Promise<ExtensionPack | undefined> {
  progress({
    message: "Resolving extension packs...",
    step: 1,
    maxStep,
  });

  // Get all existing extension packs in the workspace
  const additionalPacks = getOnDiskWorkspaceFolders();
  // the CLI doesn't check packs in the .github folder, so we need to add it manually
  if (additionalPacks.length === 1) {
    additionalPacks.push(`${additionalPacks[0]}/.github`);
  }
  const extensionPacksInfo = await cliServer.resolveQlpacks(
    additionalPacks,
    true,
  );

  progress({
    message: "Creating extension pack...",
    step: 2,
    maxStep,
  });

  // Get the `codeQL.model.extensionsDirectory` setting for the language
  const userExtensionsDirectory = getExtensionsDirectory(databaseItem.language);

  // If the setting is not set, automatically pick a suitable directory
  const extensionsDirectory = userExtensionsDirectory
    ? Uri.file(userExtensionsDirectory)
    : await autoPickExtensionsDirectory();

  if (!extensionsDirectory) {
    return undefined;
  }

  // Generate the name of the extension pack
  const packName = autoNameExtensionPack(
    databaseItem.name,
    databaseItem.language,
  );
  if (!packName) {
    void showAndLogErrorMessage(
      logger,
      `Could not automatically name extension pack for database ${databaseItem.name}`,
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
      extensionPack = await readExtensionPack(
        existingExtensionPackPaths[0],
        databaseItem.language,
      );
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

  const packPath = join(extensionsDirectory.fsPath, packName.name);

  if (await pathExists(packPath)) {
    void showAndLogErrorMessage(
      logger,
      `Directory ${packPath} already exists for extension pack ${formatPackName(
        packName,
      )}`,
    );

    return undefined;
  }

  return writeExtensionPack(packPath, packName, databaseItem.language);
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
    language,
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

async function readExtensionPack(
  path: string,
  language: string,
): Promise<ExtensionPack> {
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
    language,
    extensionTargets: qlpack.extensionTargets,
    dataExtensions,
  };
}
