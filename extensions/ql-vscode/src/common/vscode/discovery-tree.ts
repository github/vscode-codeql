import type { FileTreeNode } from "../file-tree-nodes";
import { FileTreeDirectory, FileTreeLeaf } from "../file-tree-nodes";
import { getOnDiskWorkspaceFoldersObjects } from "./workspace-folders";
import { containsPath } from "../files";
import { basename, dirname, normalize, relative } from "path";
import type { App } from "../app";

interface PathData {
  path: string;
}

/**
 * Converts path data from a FilePathDiscovery into a tree.
 *
 * Trivial directories where there is only one child will be collapsed into a single node.
 *
 * @param app The app.
 * @param pathData The path data to convert. Usually retrieved from the `getPathData` method of a `FilePathDiscovery`.
 * @param getTreeNodeData A function that returns the data to associate with a tree node, given the path data.
 * @param ignoreItem A function that will be called for every item in the path data. If it returns true, the item will be ignored.
 */
export function buildDiscoveryTree<
  PathDataItem extends PathData,
  FileTreeNodeData = undefined,
>(
  app: App,
  pathData: ReadonlyArray<Readonly<PathDataItem>> | undefined,
  getTreeNodeData?: (item: PathDataItem) => FileTreeNodeData | undefined,
  ignoreItem?: (item: PathDataItem) => boolean,
): Array<FileTreeNode<FileTreeNodeData>> | undefined {
  if (pathData === undefined) {
    return undefined;
  }

  const roots = [];
  for (const workspaceFolder of getOnDiskWorkspaceFoldersObjects()) {
    const itemsInRoot = pathData.filter(
      (item) =>
        containsPath(workspaceFolder.uri.fsPath, item.path) &&
        !ignoreItem?.(item),
    );
    if (itemsInRoot.length === 0) {
      continue;
    }
    const root = new FileTreeDirectory<FileTreeNodeData>(
      workspaceFolder.uri.fsPath,
      workspaceFolder.name,
      app.environment,
    );
    for (const item of itemsInRoot) {
      const dirName = dirname(normalize(relative(root.path, item.path)));
      const parentDirectory = root.createDirectory(dirName);
      parentDirectory.addChild(
        new FileTreeLeaf<FileTreeNodeData>(
          item.path,
          basename(item.path),
          getTreeNodeData?.(item),
        ),
      );
    }
    root.finish();
    roots.push(root);
  }
  return roots;
}
