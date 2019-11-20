import * as fs from 'fs-extra';
import * as path from 'path';
import { QLPackDiscovery } from './qlpack-discovery';
import { Discovery } from './discovery';
import { EventEmitter, Event, Uri, GlobPattern, workspace, RelativePattern } from 'vscode';
import { DisposableObject } from 'semmle-vscode-utils';

/**
 * A node in the tree of tests. This will be either a `QLTestDirector` or a `QLTestFile`.
 */
export abstract class QLTestNode {
  constructor(private _path: string, private _name: string, private _testCount: number) {
  }

  public get testCount(): number {
    return this._testCount;
  }

  public get path(): string {
    return this._path;
  }

  public get name(): string {
    return this._name;
  }

  public abstract get children(): readonly QLTestNode[];

  public static sumTestCounts(testNodes: QLTestNode[]): number {
    return testNodes.reduce<number>((prev, node) => {
      return prev + node.testCount;
    }, 0);
  }
}

/**
 * A directory containing one or more QL tests or other test directories.
 */
export class QLTestDirectory extends QLTestNode {
  constructor(_path: string, _name: string, private _children: QLTestNode[]) {
    super(_path, _name, QLTestNode.sumTestCounts(_children));
  }

  public get children(): readonly QLTestNode[] {
    return this._children;
  }

  public addChild(child: QLTestNode): void {
    this._children.push(child);
  }
}

/**
 * A single QL test. This will be either a `.ql` file or a `.qlref` file.
 */
export class QLTestFile extends QLTestNode {
  constructor(_path: string, _name: string) {
    super(_path, _name, 1);
  }

  public get children(): readonly QLTestNode[] {
    return [];
  }
}

/**
 * A collection of `FileSystemWatcher` objects. Disposing this object disposes all of the individual
 * `FileSystemWatcher` objects and their event registrations.
 */
class WatcherCollection extends DisposableObject {
  constructor() {
    super();
  }

  /**
   * Create a `FileSystemWatcher` and add it to the collection.
   * @param pattern The pattern to watch.
   * @param listener The event listener to be invoked when a watched file is created, changed, or
   *   deleted.
   * @param thisArgs The `this` argument for the event listener.
   */
  public addWatcher(pattern: GlobPattern, listener: (e: Uri) => any, thisArgs: any): void {
    const watcher = workspace.createFileSystemWatcher(pattern);
    this.push(watcher.onDidCreate(listener, thisArgs));
    this.push(watcher.onDidChange(listener, thisArgs));
    this.push(watcher.onDidDelete(listener, thisArgs));
  }
}

/**
 * A class to watch multiple patterns in the file system at the same time, reporting all
 * notifications via a single event.
 */
class MultiFileSystemWatcher extends DisposableObject {
  private readonly _onDidChange = this.push(new EventEmitter<Uri>());
  private watchers = this.track(new WatcherCollection());

  constructor() {
    super();
  }

  /**
   * Event to be fired when any watched file is created, changed, or deleted.
   */
  public get onDidChange(): Event<Uri> { return this._onDidChange.event; }

  /**
   * Adds a new pattern to watch.
   * @param pattern The pattern to watch.
   */
  public addWatch(pattern: GlobPattern): void {
    this.watchers.addWatcher(pattern, this.handleDidChange, this);
  }

  /**
   * Deletes all existing watchers.
   */
  public clear(): void {
    this.disposeAndStopTracking(this.watchers);
    this.watchers = this.track(new WatcherCollection());
  }

  private handleDidChange(uri: Uri): void {
    this._onDidChange.fire(uri);
  }
}

/**
 * The results of discovering QL tests.
 */
interface QLTestDiscoveryResults {
  /**
   * The root test directory for each QL pack that contains tests.
   */
  testDirectories: QLTestDirectory[];
  /**
   * The list of file system paths to watch. If any of these paths changes, the discovery results
   * may be out of date.
   */
  watchPaths: string[];
}

/**
 * Discovers all QL tests contained in the QL packs in a given workspace folder.
 */
export class QLTestDiscovery extends Discovery<QLTestDiscoveryResults> {
  private readonly _onDidChangeTests = this.push(new EventEmitter<void>());
  private readonly watcher: MultiFileSystemWatcher = this.push(new MultiFileSystemWatcher());
  private _testDirectories: QLTestDirectory[] = [];

  constructor(private readonly qlPackDiscovery: QLPackDiscovery) {
    super();

    this.push(this.qlPackDiscovery.onDidChangeQLPacks(this.handleDidChangeQLPacks, this));

    this.refresh();
  }

  /**
   * Event to be fired when the set of discovered tests may have changed.
   */
  public get onDidChangeTests(): Event<void> { return this._onDidChangeTests.event; }

  /**
   * The root test directory for each QL pack that contains tests.
   */
  public get testDirectories(): QLTestDirectory[] { return this._testDirectories; }

  private handleDidChangeQLPacks(): void {
    this.refresh();
  }

  protected async discover(): Promise<QLTestDiscoveryResults> {
    const testDirectories: QLTestDirectory[] = [];
    const watchPaths: string[] = [];
    const qlPacks = this.qlPackDiscovery.qlPacks;
    for (const qlPack of qlPacks) {
      //HACK: Assume that only QL packs whose name ends with '-tests' contain tests.
      if (qlPack.name.endsWith('-tests')) {
        watchPaths.push(qlPack.uri.fsPath);
        const testPackage = await this.discoverTestsFromDirectory(qlPack.uri.fsPath, qlPack.name);
        if (testPackage !== undefined) {
          testDirectories.push(testPackage);
        }
      }
    }

    return {
      testDirectories: testDirectories,
      watchPaths: watchPaths
    };
  }

  protected update(results: QLTestDiscoveryResults): void {
    this._testDirectories = results.testDirectories;

    // Watch for changes to any `.ql` or `.qlref` file in any of the QL packs that contain tests.
    this.watcher.clear();
    results.watchPaths.forEach(watchPath => {
      this.watcher.addWatch(new RelativePattern(watchPath, '**/*.{ql,qlref}'));
    });
    this._onDidChangeTests.fire();
  }

  /**
   * Discover all QL tests in the specified directory and its subdirectories.
   * @param fullPath The full path of the test directory.
   * @param name The display name to use for the returned `TestDirectory` object.
   * @returns A `QLTestDirectory` object describing the contents of the directory, or `undefined` if
   *   no tests were found.
   */
  private async discoverTestsFromDirectory(fullPath: string, name: string):
    Promise<QLTestDirectory | undefined> {

    const childPaths = await fs.readdir(fullPath);
    const childNodes: QLTestNode[] = [];
    const childDirectories: string[] = [];
    for (const childPath of childPaths) {
      const fullChildPath = path.join(fullPath, childPath);
      const stats = await fs.lstat(fullChildPath);
      if (stats.isFile()) {
        const childNode = await this.discoverTestFromFile(fullChildPath, childPath);
        if (childNode) {
          childNodes.push(childNode);
        }
      }
      else if (stats.isDirectory()) {
        childDirectories.push(childPath);
      }
    }

    // If we didn't find any test files, scan child directories.
    if (childNodes.length === 0) {
      for (const childPath of childDirectories) {
        const fullChildPath = path.join(fullPath, childPath);
        const childNode = await this.discoverTestsFromDirectory(fullChildPath, childPath);
        if (childNode) {
          childNodes.push(childNode);
        }
      }
    }

    if (childNodes.length > 0) {
      return new QLTestDirectory(fullPath, name, childNodes);
    }
    else {
      return undefined;
    }
  }

  /**
   * Discover the QL test implemented by the specified file.
   * @param fullPath The full path of the file implementing the test.
   * @param name The display name to use for the returned `QLTestFile` object.
   * @returns A `QLTestFile` object describing the QL test implemented by the file, or `undefined`
   *   if ths specified file does not implement a QL test.
   */
  private async discoverTestFromFile(fullPath: string, name: string):
    Promise<QLTestNode | undefined> {

    switch (path.extname(fullPath).toLowerCase()) {
      case '.ql':
      case '.qlref': {
        if (!path.basename(fullPath).startsWith('__')) {
          const test = new QLTestFile(fullPath, name);
          return test;
        }
      }
        break;

      default:
        break;
    }

    return undefined;
  }
}
