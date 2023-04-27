import { dirname, basename, join, normalize, relative, extname } from "path";
import { Discovery } from "./discovery";
import {
  EventEmitter,
  Event,
  Uri,
  RelativePattern,
  WorkspaceFolder,
  env,
} from "vscode";
import { MultiFileSystemWatcher } from "./vscode-utils/multi-file-system-watcher";
import { CodeQLCliServer } from "./codeql-cli/cli";
import { pathExists } from "fs-extra";

/**
 * A node in the tree of tests. This will be either a `QLTestDirectory` or a `QLTestFile`.
 */
export abstract class QLTestNode {
  constructor(private _path: string, private _name: string) {}

  public get path(): string {
    return this._path;
  }

  public get name(): string {
    return this._name;
  }

  public abstract get children(): readonly QLTestNode[];

  public abstract finish(): void;
}

/**
 * A directory containing one or more QL tests or other test directories.
 */
export class QLTestDirectory extends QLTestNode {
  constructor(
    _path: string,
    _name: string,
    private _children: QLTestNode[] = [],
  ) {
    super(_path, _name);
  }

  public get children(): readonly QLTestNode[] {
    return this._children;
  }

  public addChild(child: QLTestNode): void {
    this._children.push(child);
  }

  public createDirectory(relativePath: string): QLTestDirectory {
    const dirName = dirname(relativePath);
    if (dirName === ".") {
      return this.createChildDirectory(relativePath);
    } else {
      const parent = this.createDirectory(dirName);
      return parent.createDirectory(basename(relativePath));
    }
  }

  public finish(): void {
    // remove empty directories
    this._children.filter(
      (child) => child instanceof QLTestFile || child.children.length > 0,
    );
    this._children.sort((a, b) => a.name.localeCompare(b.name, env.language));
    this._children.forEach((child, i) => {
      child.finish();
      if (
        child.children?.length === 1 &&
        child.children[0] instanceof QLTestDirectory
      ) {
        // collapse children
        const replacement = new QLTestDirectory(
          child.children[0].path,
          `${child.name} / ${child.children[0].name}`,
          Array.from(child.children[0].children),
        );
        this._children[i] = replacement;
      }
    });
  }

  private createChildDirectory(name: string): QLTestDirectory {
    const existingChild = this._children.find((child) => child.name === name);
    if (existingChild !== undefined) {
      return existingChild as QLTestDirectory;
    } else {
      const newChild = new QLTestDirectory(join(this.path, name), name);
      this.addChild(newChild);
      return newChild;
    }
  }
}

/**
 * A single QL test. This will be either a `.ql` file or a `.qlref` file.
 */
export class QLTestFile extends QLTestNode {
  constructor(_path: string, _name: string) {
    super(_path, _name);
  }

  public get children(): readonly QLTestNode[] {
    return [];
  }

  public finish(): void {
    /**/
  }
}

/**
 * The results of discovering QL tests.
 */
interface QLTestDiscoveryResults {
  /**
   * A directory that contains one or more QL Tests, or other QLTestDirectories.
   */
  testDirectory: QLTestDirectory | undefined;

  /**
   * The file system path to a directory to watch. If any ql or qlref file changes in
   * this directory, then this signifies a change in tests.
   */
  watchPath: string;
}

/**
 * Discovers all QL tests contained in the QL packs in a given workspace folder.
 */
export class QLTestDiscovery extends Discovery<QLTestDiscoveryResults> {
  private readonly _onDidChangeTests = this.push(new EventEmitter<void>());
  private readonly watcher: MultiFileSystemWatcher = this.push(
    new MultiFileSystemWatcher(),
  );
  private _testDirectory: QLTestDirectory | undefined;

  constructor(
    private readonly workspaceFolder: WorkspaceFolder,
    private readonly cliServer: CodeQLCliServer,
  ) {
    super("QL Test Discovery");

    this.push(this.watcher.onDidChange(this.handleDidChange, this));
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
  public get testDirectory(): QLTestDirectory | undefined {
    return this._testDirectory;
  }

  private handleDidChange(uri: Uri): void {
    if (!QLTestDiscovery.ignoreTestPath(uri.fsPath)) {
      this.refresh();
    }
  }
  protected async discover(): Promise<QLTestDiscoveryResults> {
    const testDirectory = await this.discoverTests();
    return {
      testDirectory,
      watchPath: this.workspaceFolder.uri.fsPath,
    };
  }

  protected update(results: QLTestDiscoveryResults): void {
    this._testDirectory = results.testDirectory;

    this.watcher.clear();
    // Watch for changes to any `.ql` or `.qlref` file in any of the QL packs that contain tests.
    this.watcher.addWatch(
      new RelativePattern(results.watchPath, "**/*.{ql,qlref}"),
    );
    // need to explicitly watch for changes to directories themselves.
    this.watcher.addWatch(new RelativePattern(results.watchPath, "**/"));
    this._onDidChangeTests.fire(undefined);
  }

  /**
   * Discover all QL tests in the specified directory and its subdirectories.
   * @returns A `QLTestDirectory` object describing the contents of the directory, or `undefined` if
   *   no tests were found.
   */
  private async discoverTests(): Promise<QLTestDirectory> {
    const fullPath = this.workspaceFolder.uri.fsPath;
    const name = this.workspaceFolder.name;
    const rootDirectory = new QLTestDirectory(fullPath, name);

    // Don't try discovery on workspace folders that don't exist on the filesystem
    if (await pathExists(fullPath)) {
      const resolvedTests = (
        await this.cliServer.resolveTests(fullPath)
      ).filter((testPath) => !QLTestDiscovery.ignoreTestPath(testPath));
      for (const testPath of resolvedTests) {
        const relativePath = normalize(relative(fullPath, testPath));
        const dirName = dirname(relativePath);
        const parentDirectory = rootDirectory.createDirectory(dirName);
        parentDirectory.addChild(new QLTestFile(testPath, basename(testPath)));
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
