import type { ExtensionContext, Memento } from "vscode";
import { Uri } from "vscode";
import { createMockMemento } from "../mock-memento";

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
  workspaceState?: Memento;
}): ExtensionContext {
  return {
    extensionPath,
    globalStorageUri: Uri.file(globalStoragePath),
    storageUri: Uri.file(workspaceStoragePath),
    workspaceState: createMockMemento(),
    subscriptions: [],
  } as any as ExtensionContext;
}
