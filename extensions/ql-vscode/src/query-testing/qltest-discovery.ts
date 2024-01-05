import { dirname, basename, normalize, relative, extname } from "path";
import { Discovery } from "../common/discovery";
import type { Event, Uri, WorkspaceFolder } from "vscode";
import { EventEmitter, RelativePattern, env } from "vscode";
import { MultiFileSystemWatcher } from "../common/vscode/multi-file-system-watcher";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import { pathExists } from "fs-extra";
import { FileTreeDirectory, FileTreeLeaf } from "../common/file-tree-nodes";
import { extLogger } from "../common/logging/vscode";

/**
 * Discovers all QL tests contained in the QL packs in a given workspace folder.
 */
export class QLTestDiscovery extends Discovery {
  private readonly _onDidChangeTests = this.push(new EventEmitter<void>());
  private readonly watcher: MultiFileSystemWatcher = this.push(
    new MultiFileSystemWatcher(),
  );
  private _testDirectory: FileTreeDirectory | undefined;

  constructor(
    private readonly workspaceFolder: WorkspaceFolder,
    private readonly cliServer: CodeQLCliServer,
  ) {
    super("QL Test Discovery", extLogger);

    this.push(this.watcher.onDidChange(this.handleDidChange, this));

    // Watch for changes to any `.ql` or `.qlref` file in any of the QL packs that contain tests.
    this.watcher.addWatch(
      new RelativePattern(this.workspaceFolder.uri.fsPath, "**/*.{ql,qlref}"),
    );
    // need to explicitly watch for changes to directories themselves.
    this.watcher.addWatch(
      new RelativePattern(this.workspaceFolder.uri.fsPath, "**/"),
    );
  }

  /**
   * Event to be fired when the set of discovered tests may have changed.
   */
  public get onDidChangeTests(): Event<void> {
    return this._onDidChangeTests.event;
  }

  /**
   * The root directory. There is at least one test in this directory, or
   * in a subdirectory of this.
   */
  public get testDirectory(): FileTreeDirectory | undefined {
    return this._testDirectory;
  }

  private handleDidChange(uri: Uri): void {
    if (!QLTestDiscovery.ignoreTestPath(uri.fsPath)) {
      void this.refresh();
    }
  }
  protected async discover() {
    this._testDirectory = await this.discoverTests();

    this._onDidChangeTests.fire(undefined);
  }

  /**
   * Discover all QL tests in the specified directory and its subdirectories.
   * @returns A `QLTestDirectory` object describing the contents of the directory, or `undefined` if
   *   no tests were found.
   */
  private async discoverTests(): Promise<FileTreeDirectory> {
    const fullPath = this.workspaceFolder.uri.fsPath;
    const name = this.workspaceFolder.name;
    const rootDirectory = new FileTreeDirectory(fullPath, name, env);

    // Don't try discovery on workspace folders that don't exist on the filesystem
    if (await pathExists(fullPath)) {
      const resolvedTests = (
        await this.cliServer.resolveTests(fullPath)
      ).filter((testPath) => !QLTestDiscovery.ignoreTestPath(testPath));
      for (const testPath of resolvedTests) {
        const relativePath = normalize(relative(fullPath, testPath));
        const dirName = dirname(relativePath);
        const parentDirectory = rootDirectory.createDirectory(dirName);
        parentDirectory.addChild(
          new FileTreeLeaf(testPath, basename(testPath)),
        );
      }

      rootDirectory.finish();
    }
    return rootDirectory;
  }

  /**
   * Determine if the specified QL test should be ignored based on its filename.
   * @param testPath Path to the test file.
   */
  private static ignoreTestPath(testPath: string): boolean {
    switch (extname(testPath).toLowerCase()) {
      case ".ql":
      case ".qlref":
        return basename(testPath).startsWith("__");

      default:
        return false;
    }
  }
}
