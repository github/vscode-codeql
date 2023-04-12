import { relative } from "path";
import { window } from "vscode";
import { CodeQLCliServer } from "../cli";
import { getOnDiskWorkspaceFolders, showAndLogErrorMessage } from "../helpers";
import { ProgressCallback } from "../progress";

const maxStep = 3;

export async function pickExtensionPackModelFile(
  cliServer: Pick<CodeQLCliServer, "resolveQlpacks" | "resolveExtensions">,
  progress: ProgressCallback,
): Promise<string | undefined> {
  const extensionPackPath = await pickExtensionPack(cliServer, progress);
  if (!extensionPackPath) {
    return;
  }

  const modelFile = await pickModelFile(cliServer, progress, extensionPackPath);
  if (!modelFile) {
    return;
  }

  return modelFile;
}

async function pickExtensionPack(
  cliServer: Pick<CodeQLCliServer, "resolveQlpacks">,
  progress: ProgressCallback,
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

  const extensionPackOption = await window.showQuickPick(options, {
    title: "Select extension pack to use",
  });
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
  progress: ProgressCallback,
  extensionPackPath: string,
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

  const fileOptions: Array<{ label: string; file: string }> = [];
  for (const file of modelFiles) {
    fileOptions.push({
      label: relative(extensionPackPath, file),
      file,
    });
  }

  progress({
    message: "Choosing model file...",
    step: 3,
    maxStep,
  });

  const fileOption = await window.showQuickPick(fileOptions, {
    title: "Select model file to use",
  });

  if (!fileOption) {
    return;
  }

  return fileOption.file;
}
