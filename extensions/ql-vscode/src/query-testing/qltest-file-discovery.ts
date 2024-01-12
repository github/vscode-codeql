import { FilePathDiscovery } from "../common/vscode/file-path-discovery";
import type { App } from "../common/app";
import type { AppEvent, AppEventEmitter } from "../common/events";
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  relative,
  sep,
} from "path";
import type { Event } from "vscode";
import { containsPath } from "../common/files";
import { pathExists } from "fs-extra";
import type { FileTreeNode } from "../common/file-tree-nodes";
import { FileTreeDirectory, FileTreeLeaf } from "../common/file-tree-nodes";
import { getOnDiskWorkspaceFoldersObjects } from "../common/vscode/workspace-folders";

export interface QueryPackDiscoverer {
  getTestsPathForFile(path: string): string | undefined;
  onDidChangeQueryPacks: Event<void>;
}

interface Test {
  path: string;
}

const QUERY_FILE_EXTENSION = ".ql";
const QUERY_TEST_FILE_EXTENSION = ".qlref";

/**
 * Discovers all QL tests contained in the QL packs in all workspace folders.
 */
export class QLTestFileDiscovery extends FilePathDiscovery<Test> {
  private readonly onDidChangeTestsEmitter: AppEventEmitter<void>;
  public readonly onDidChangeTests: AppEvent<void>;

  constructor(
    private readonly app: App,
    private readonly queryPackDiscovery: QueryPackDiscoverer,
  ) {
    super(
      "QL Test Discovery",
      `**/*{${QUERY_FILE_EXTENSION},${QUERY_TEST_FILE_EXTENSION}}`,
    );

    this.onDidChangeTestsEmitter = this.push(app.createEventEmitter());
    this.onDidChangeTests = this.onDidChangeTestsEmitter.event;

    this.push(
      this.queryPackDiscovery.onDidChangeQueryPacks(
        this.recomputeAllData.bind(this),
      ),
    );
    this.push(
      this.onDidChangePathData(() => {
        this.onDidChangeTestsEmitter.fire();
      }),
    );
  }

  /**
   * Return all known tests, represented as a tree.
   *
   * Trivial directories where there is only one child will be collapsed into a single node.
   */
  public buildTestTree(): FileTreeNode[] | undefined {
    const pathData = this.getPathData();
    if (pathData === undefined) {
      return undefined;
    }

    const roots = [];
    for (const workspaceFolder of getOnDiskWorkspaceFoldersObjects()) {
      const queriesInRoot = pathData.filter((query) =>
        containsPath(workspaceFolder.uri.fsPath, query.path),
      );
      if (queriesInRoot.length === 0) {
        continue;
      }
      const root = new FileTreeDirectory(
        workspaceFolder.uri.fsPath,
        workspaceFolder.name,
        this.app.environment,
      );
      for (const query of queriesInRoot) {
        const dirName = dirname(normalize(relative(root.path, query.path)));
        const parentDirectory = root.createDirectory(dirName);
        parentDirectory.addChild(
          new FileTreeLeaf(query.path, basename(query.path)),
        );
      }
      root.finish();
      roots.push(root);
    }
    return roots;
  }

  protected async getDataForPath(path: string): Promise<Test | undefined> {
    const testsPath = this.queryPackDiscovery.getTestsPathForFile(path);

    if (testsPath !== undefined) {
      if (!containsPath(testsPath, path)) {
        // The file is not in the tests directory, so we don't need to include it
        return undefined;
      }
      // The file is in the tests directory, so it's definitely a test
    } else {
      // If we're not in a pack or in a pack that doesn't declare a tests directory,
      // we should only include the file if a .expected file exists for this test.
      const expectedFile = join(
        dirname(path),
        `${basename(path).slice(0, -extname(path).length)}.expected`,
      );

      if (!(await pathExists(expectedFile))) {
        return undefined;
      }
    }

    return { path };
  }

  protected pathIsRelevant(path: string): boolean {
    if (
      !path.endsWith(QUERY_FILE_EXTENSION) &&
      !path.endsWith(QUERY_TEST_FILE_EXTENSION)
    ) {
      return false;
    }

    // Ignore files that start with "__"
    if (basename(path).startsWith("__")) {
      return false;
    }

    const pathParts = path.split(sep);

    // If at any point in the parent directories we find a directory named
    // "{something}.testproj" and its parent directory is called "{something}"
    // we should not include this file
    if (
      pathParts.slice(0, pathParts.length - 1).some((part, index) => {
        if (part.endsWith(".testproj") && index > 0) {
          const parent = pathParts[index - 1];
          return part === `${parent}.testproj`;
        }
        return false;
      })
    ) {
      return false;
    }

    return true;
  }

  protected shouldOverwriteExistingData(): boolean {
    // The data doesn't change, so we don't need to overwrite.
    return false;
  }
}
