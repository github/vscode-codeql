import * as vscode from "vscode";

/**
 * Creates a partially implemented mock of vscode.ExtensionContext.
 */
export function createMockExtensionContext({
  extensionPath = "/mock/extension/path",
  workspaceStoragePath = "/mock/workspace/storage/path",
  globalStoragePath = "/mock/global/storage/path",
}: {
  extensionPath?: string;
  workspaceStoragePath?: string;
  globalStoragePath?: string;
}): vscode.ExtensionContext {
  return {
    extensionPath,
    globalStorageUri: vscode.Uri.file(globalStoragePath),
    storageUri: vscode.Uri.file(workspaceStoragePath),
  } as any as vscode.ExtensionContext;
}
