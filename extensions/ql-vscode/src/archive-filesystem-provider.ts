import * as fs from 'fs-extra';
import * as unzipper from 'unzipper';
import * as vscode from 'vscode';
import { logger } from './logging';

// All path operations in this file must be on paths *within* the zip
// archive.
import * as _path from 'path';
const path = _path.posix;

export class File implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;

  constructor(public name: string, public data: Uint8Array) {
    this.type = vscode.FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = data.length;
    this.name = name;
  }
}

export class Directory implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;
  entries: Map<string, Entry> = new Map();

  constructor(public name: string) {
    this.type = vscode.FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
  }
}

export type Entry = File | Directory;

/**
 * A map containing directory hierarchy information in a convenient form.
 *
 * For example, if dirMap : DirectoryHierarchyMap, and /foo/bar/baz.c is a file in the
 * directory structure being represented, then
 *
 * dirMap['/foo'] = {'bar': vscode.FileType.Directory}
 * dirMap['/foo/bar'] = {'baz': vscode.FileType.File}
 */
export type DirectoryHierarchyMap = { [k: string]: { [e: string]: vscode.FileType } };

export type ZipFileReference = { sourceArchiveZipPath: string, pathWithinSourceArchive: string };

export function encodeSourceArchiveUri(ref: ZipFileReference): vscode.Uri {
  const { sourceArchiveZipPath, pathWithinSourceArchive } = ref;
  const authority = sourceArchiveZipPath.length.toString();
  return vscode.Uri.parse(zipArchiveScheme + ':/').with({
    path: path.join(sourceArchiveZipPath, pathWithinSourceArchive),
    authority,
  });
}

export function decodeSourceArchiveUri(uri: vscode.Uri): ZipFileReference {
  const zipLength = parseInt(uri.authority);
  if (zipLength === undefined)
    throw new Error(`Can't decode uri ${uri}, authority should be a number`);
  return {
    pathWithinSourceArchive: uri.path.substr(zipLength),
    sourceArchiveZipPath: uri.path.substr(0, zipLength),
  };
}

/**
 * Make sure `file` and all of its parent directories are represented in `map`.
 */
function ensureFile(map: DirectoryHierarchyMap, file: string) {
  const dirname = path.dirname(file);
  ensureDir(map, dirname);
  map[dirname][path.basename(file)] = vscode.FileType.File;
}

/**
 * Make sure `dir` and all of its parent directories are represented in `map`.
 */
function ensureDir(map: DirectoryHierarchyMap, dir: string) {
  const parent = path.dirname(dir);
  if (map[dir] === undefined) {
    map[dir] = {};
    if (dir !== parent) { // not the root directory
      ensureDir(map, parent);
      map[parent][path.basename(dir)] = vscode.FileType.Directory;
    }
  }
}

type Archive = {
  unzipped: unzipper.CentralDirectory,
  dirMap: DirectoryHierarchyMap,
};

export class ArchiveFileSystemProvider implements vscode.FileSystemProvider {
  private readOnlyError = vscode.FileSystemError.NoPermissions('write operation attempted, but source archive filesystem is readonly');
  private archives: { [zipPath: string]: Archive } = {};

  private async getArchive(zipPath: string): Promise<Archive> {
    if (this.archives[zipPath] === undefined) {
      if (!await fs.pathExists(zipPath))
        throw vscode.FileSystemError.FileNotFound(zipPath);
      const archive: Archive = { unzipped: await unzipper.Open.file(zipPath), dirMap: {} };
      archive.unzipped.files.forEach(f => { ensureFile(archive.dirMap, path.resolve('/', f.path)); });
      this.archives[zipPath] = archive;
    }
    return this.archives[zipPath];
  }

  root = new Directory('');

  // metadata

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    return await this._lookup(uri, false);
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    logger.log(`readdir ${uri}`);
    const ref = decodeSourceArchiveUri(uri);
    const archive = await this.getArchive(ref.sourceArchiveZipPath);
    const result = Object.entries(archive.dirMap[ref.pathWithinSourceArchive]);
    if (result === undefined) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return result;
  }

  // file contents

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const data = (await this._lookupAsFile(uri, false)).data;
    if (data) {
      return data;
    }
    throw vscode.FileSystemError.FileNotFound();
  }

  // write operations, all disabled

  writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void {
    throw this.readOnlyError;
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
    throw this.readOnlyError;
  }

  delete(uri: vscode.Uri): void {
    throw this.readOnlyError;
  }

  createDirectory(uri: vscode.Uri): void {
    throw this.readOnlyError;
  }

  // content lookup

  private async _lookup(uri: vscode.Uri, silent: boolean): Promise<Entry> {
    const ref = decodeSourceArchiveUri(uri);
    const archive = await this.getArchive(ref.sourceArchiveZipPath);

    // this is a path inside the archive, so don't use `.fsPath`, and
    // use '/' as path separator throughout
    const reqPath = ref.pathWithinSourceArchive;

    const file = archive.unzipped.files.find(
      f => {
        const absolutePath = path.resolve('/', f.path);
        return absolutePath === reqPath
          || absolutePath === path.join('/src_archive', reqPath);
      }
    );
    if (file !== undefined) {
      if (file.type === 'File') {
        return new File(reqPath, await file.buffer());
      }
      else { // file.type === 'Directory'
        // I haven't observed this case in practice. Could it happen
        // with a zip file that contains empty directories?
        return new Directory(reqPath);
      }
    }
    if (archive.dirMap[reqPath] !== undefined) {
      return new Directory(reqPath);
    }
    throw vscode.FileSystemError.FileNotFound(uri);
  }

  private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
    let entry = this._lookup(uri, silent);
    if (entry instanceof Directory) {
      return entry;
    }
    throw vscode.FileSystemError.FileNotADirectory(uri);
  }

  private async _lookupAsFile(uri: vscode.Uri, silent: boolean): Promise<File> {
    let entry = await this._lookup(uri, silent);
    if (entry instanceof File) {
      return entry;
    }
    throw vscode.FileSystemError.FileIsADirectory(uri);
  }

  private _lookupParentDirectory(uri: vscode.Uri): Directory {
    const dirname = uri.with({ path: path.dirname(uri.path) });
    return this._lookupAsDirectory(dirname, false);
  }

  // file events

  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private _bufferedEvents: vscode.FileChangeEvent[] = [];
  private _fireSoonHandle?: NodeJS.Timer;

  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

  watch(_resource: vscode.Uri): vscode.Disposable {
    // ignore, fires for all changes...
    return new vscode.Disposable(() => { });
  }

  private _fireSoon(...events: vscode.FileChangeEvent[]): void {
    this._bufferedEvents.push(...events);

    if (this._fireSoonHandle) {
      clearTimeout(this._fireSoonHandle);
    }

    this._fireSoonHandle = setTimeout(() => {
      this._emitter.fire(this._bufferedEvents);
      this._bufferedEvents.length = 0;
    }, 5);
  }
}

/**
 * Custom uri scheme for referring to files inside zip archives stored
 * in the filesystem.
 * For example:
 * `ql-zip-archive:///home/alice/semmle/home/projects/turboencabulator/revision-2019-August-02--08-50-01/output/src_archive.zip#/home/alice/foobar/foobar.c`
 * refers to file `/home/alice/foobar/foobar.c` inside `src_archive.zip`.
 *
 * (cf. https://www.ietf.org/rfc/rfc2396.txt (Appendix A, page 26) for
 * the fact that hyphens are allowed in uri schemes)
 */
export const zipArchiveScheme = 'codeql-zip-archive';

export function activate(ctx: vscode.ExtensionContext) {
  const schemeRootUri = vscode.Uri.parse(zipArchiveScheme + ':/');
  ctx.subscriptions.push(vscode.workspace.registerFileSystemProvider(
    zipArchiveScheme,
    new ArchiveFileSystemProvider(),
    {
      isCaseSensitive: true,
      isReadonly: true,
    }
  ));
}
