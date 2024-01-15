import { FilePathDiscovery } from "../common/vscode/file-path-discovery";
import type { App } from "../common/app";
import type { AppEvent, AppEventEmitter } from "../common/events";
import { basename, dirname, extname, join, sep } from "path";
import type { Event } from "vscode";
import { RelativePattern, workspace } from "vscode";
import { containsPath } from "../common/files";
import type { FileTreeNode } from "../common/file-tree-nodes";
import { buildDiscoveryTree } from "../common/vscode/discovery-tree";

export interface QueryPackDiscoverer {
  getTestsPathForFile(path: string): string | undefined;
  onDidChangeQueryPacks: Event<void>;
}

interface Test {
  path: string;
}

interface Context {
  /**
   * The set of `.expected` files that exist for this directory. Normalized
   * using the `normalizeExpectedPath` function.
   */
  expectedFiles: Set<string>;
}

function normalizeExpectedPath(path: string): string {
  return path.toLowerCase();
}

const QUERY_FILE_EXTENSION = ".ql";
const QUERY_TEST_FILE_EXTENSION = ".qlref";
const EXPECTED_FILE_EXTENSION = ".expected";

/**
 * Discovers all QL tests contained in the QL packs in all workspace folders.
 */
export class QLTestDiscovery extends FilePathDiscovery<Test, Context> {
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
    return buildDiscoveryTree(this.app, this.getPathData());
  }

  protected async getDataForPath(
    path: string,
    context: Context,
  ): Promise<Test | undefined> {
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

      if (!context.expectedFiles.has(normalizeExpectedPath(expectedFile))) {
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

  /**
   * The context for a path is the set of `.expected` files that exist for this directory. This is
   * a performance optimization: checking the existence of every `.expected` file separately can take
   * 30+ seconds, while finding all `.expected` files in a directory is much faster (less than 1 second
   * for the entire workspace).
   */
  protected async computeContext(path: string): Promise<Context> {
    const expectedFiles = await workspace.findFiles(
      new RelativePattern(path, `**/*${EXPECTED_FILE_EXTENSION}`),
    );

    return {
      expectedFiles: new Set(
        expectedFiles.map((file) => normalizeExpectedPath(file.fsPath)),
      ),
    };
  }
}
