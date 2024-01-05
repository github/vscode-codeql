import { Discovery } from "../discovery";
import type { Event, Uri, WorkspaceFoldersChangeEvent } from "vscode";
import { EventEmitter, RelativePattern, workspace } from "vscode";
import { MultiFileSystemWatcher } from "./multi-file-system-watcher";
import type { AppEventEmitter } from "../events";
import { extLogger } from "../logging/vscode";
import { lstat } from "fs-extra";
import { containsPath, isIOError } from "../files";
import {
  getOnDiskWorkspaceFolders,
  getOnDiskWorkspaceFoldersObjects,
} from "./workspace-folders";
import { getErrorMessage } from "../../common/helpers-pure";

interface PathData {
  path: string;
}

/**
 * Discovers and watches for changes to all files matching a given filter
 * contained in the workspace. Also allows computing extra data about each
 * file path, and only recomputing the data when the file changes.
 *
 * Scans the whole workspace on startup, and then watches for changes to files
 * to do the minimum work to keep up with changes.
 *
 * Can configure which changes it watches for, which files are considered
 * relevant, and what extra data to compute for each file.
 */
export abstract class FilePathDiscovery<T extends PathData> extends Discovery {
  /**
   * Has `discover` been called. This allows distinguishing between
   * "no paths found" and not having scanned yet.
   */
  private discoverHasCompletedOnce = false;

  /** The set of known paths and associated data that we are tracking */
  private pathData: T[] = [];

  /** Event that fires whenever the contents of `pathData` changes */
  private readonly onDidChangePathDataEmitter: AppEventEmitter<void>;

  /**
   * The set of file paths that may have changed on disk since the last time
   * refresh was run. Whenever a watcher reports some change to a file we add
   * it to this set, and then during the next refresh we will process all
   * file paths from this set and update our internal state to match whatever
   * we find on disk (i.e. the file exists, doesn't exist, computed data has
   * changed).
   */
  private readonly changedFilePaths = new Set<string>();

  /**
   * Watches for changes to files and directories in all workspace folders.
   */
  private readonly watcher: MultiFileSystemWatcher = this.push(
    new MultiFileSystemWatcher(),
  );

  /**
   * @param name Name of the discovery operation, for logging purposes.
   * @param fileWatchPattern Passed to `vscode.RelativePattern` to determine the files to watch for changes to.
   */
  constructor(
    name: string,
    private readonly fileWatchPattern: string,
  ) {
    super(name, extLogger);

    this.onDidChangePathDataEmitter = this.push(new EventEmitter<void>());
    this.push(
      workspace.onDidChangeWorkspaceFolders(
        this.workspaceFoldersChanged.bind(this),
      ),
    );
    this.push(this.watcher.onDidChange(this.fileChanged.bind(this)));
  }

  protected getPathData(): ReadonlyArray<Readonly<T>> | undefined {
    if (!this.discoverHasCompletedOnce) {
      return undefined;
    }
    return this.pathData;
  }

  protected get onDidChangePathData(): Event<void> {
    return this.onDidChangePathDataEmitter.event;
  }

  /**
   * Compute any extra data to be stored regarding the given path.
   */
  protected abstract getDataForPath(path: string): Promise<T>;

  /**
   * Is the given path relevant to this discovery operation?
   */
  protected abstract pathIsRelevant(path: string): boolean;

  /**
   * Should the given new data overwrite the existing data we have stored?
   */
  protected abstract shouldOverwriteExistingData(
    newData: T,
    existingData: T,
  ): boolean;

  /**
   * Update the data for every path by calling `getDataForPath`.
   */
  protected async recomputeAllData() {
    this.pathData = await Promise.all(
      this.pathData.map((p) => this.getDataForPath(p.path)),
    );
    this.onDidChangePathDataEmitter.fire();
  }

  /**
   * Do the initial scan of the entire workspace and set up watchers for future changes.
   */
  public async initialRefresh() {
    getOnDiskWorkspaceFolders().forEach((workspaceFolder) => {
      this.changedFilePaths.add(workspaceFolder);
    });

    this.updateWatchers();
    await this.refresh();
    this.onDidChangePathDataEmitter.fire();
  }

  private workspaceFoldersChanged(event: WorkspaceFoldersChangeEvent) {
    event.added.forEach((workspaceFolder) => {
      this.changedFilePaths.add(workspaceFolder.uri.fsPath);
    });
    event.removed.forEach((workspaceFolder) => {
      this.changedFilePaths.add(workspaceFolder.uri.fsPath);
    });

    this.updateWatchers();
    void this.refresh();
  }

  private updateWatchers() {
    this.watcher.clear();
    for (const workspaceFolder of getOnDiskWorkspaceFoldersObjects()) {
      // Watch for changes to individual files
      this.watcher.addWatch(
        new RelativePattern(workspaceFolder, this.fileWatchPattern),
      );
      // need to explicitly watch for changes to directories themselves.
      this.watcher.addWatch(new RelativePattern(workspaceFolder, "**/"));
    }
  }

  private fileChanged(uri: Uri) {
    this.changedFilePaths.add(uri.fsPath);
    void this.refresh();
  }

  protected async discover() {
    let pathsUpdated = false;
    for (const path of this.changedFilePaths) {
      try {
        this.changedFilePaths.delete(path);
        if (await this.handleChangedPath(path)) {
          pathsUpdated = true;
        }
      } catch (e) {
        // If we get an error while processing a path, just log it and continue.
        // There aren't any network operations happening here or anything else
        // that's likely to succeed on a retry, so don't bother adding it back
        // to the changedFilePaths set.
        void extLogger.log(
          `${
            this.name
          } failed while processing path "${path}": ${getErrorMessage(e)}`,
        );
      }
    }

    this.discoverHasCompletedOnce = true;
    if (pathsUpdated) {
      this.onDidChangePathDataEmitter.fire();
    }
  }

  private async handleChangedPath(path: string): Promise<boolean> {
    try {
      // If the path is not in the workspace then we don't want to be
      // tracking or displaying it, so treat it as if it doesn't exist.
      if (!this.pathIsInWorkspace(path)) {
        return this.handleRemovedPath(path);
      }

      if ((await lstat(path)).isDirectory()) {
        return await this.handleChangedDirectory(path);
      } else {
        return this.handleChangedFile(path);
      }
    } catch (e) {
      if (isIOError(e) && e.code === "ENOENT") {
        return this.handleRemovedPath(path);
      }
      throw e;
    }
  }

  private pathIsInWorkspace(path: string): boolean {
    return getOnDiskWorkspaceFolders().some((workspaceFolder) =>
      containsPath(workspaceFolder, path),
    );
  }

  private handleRemovedPath(path: string): boolean {
    const oldLength = this.pathData.length;
    this.pathData = this.pathData.filter(
      (existingPathData) => !containsPath(path, existingPathData.path),
    );
    return this.pathData.length !== oldLength;
  }

  private async handleChangedDirectory(path: string): Promise<boolean> {
    const newPaths = await workspace.findFiles(
      new RelativePattern(path, this.fileWatchPattern),
    );

    let pathsUpdated = false;
    for (const path of newPaths) {
      if (await this.addOrUpdatePath(path.fsPath)) {
        pathsUpdated = true;
      }
    }
    return pathsUpdated;
  }

  private async handleChangedFile(path: string): Promise<boolean> {
    if (this.pathIsRelevant(path)) {
      return await this.addOrUpdatePath(path);
    } else {
      return false;
    }
  }

  private async addOrUpdatePath(path: string): Promise<boolean> {
    const data = await this.getDataForPath(path);
    const existingPathDataIndex = this.pathData.findIndex(
      (existingPathData) => existingPathData.path === path,
    );
    if (existingPathDataIndex !== -1) {
      if (
        this.shouldOverwriteExistingData(
          data,
          this.pathData[existingPathDataIndex],
        )
      ) {
        this.pathData.splice(existingPathDataIndex, 1, data);
        return true;
      } else {
        return false;
      }
    } else {
      this.pathData.push(data);
      return true;
    }
  }
}
