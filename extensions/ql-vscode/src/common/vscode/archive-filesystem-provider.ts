import { pathExists } from "fs-extra";
import type { Entry as ZipEntry, ZipFile } from "yauzl";
import type {
  Event,
  ExtensionContext,
  FileChangeEvent,
  FileStat,
  FileSystemProvider,
} from "vscode";
import {
  Disposable,
  EventEmitter,
  FileSystemError,
  FileType,
  Uri,
  workspace,
} from "vscode";
import { extLogger } from "../logging/vscode";
import {
  excludeDirectories,
  openZip,
  openZipBuffer,
  readZipEntries,
} from "../unzip";

// All path operations in this file must be on paths *within* the zip
// archive.
import { posix } from "path";
import { DatabaseEventKind } from "../../databases/local-databases/database-events";
import type { DatabaseManager } from "../../databases/local-databases/database-manager";

const path = posix;

class File implements FileStat {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;

  constructor(
    public name: string,
    public data: Uint8Array,
  ) {
    this.type = FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = data.length;
    this.name = name;
  }
}

class Directory implements FileStat {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;
  entries: Map<string, Entry> = new Map();

  constructor(public name: string) {
    this.type = FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
  }
}

type Entry = File | Directory;

/**
 * A map containing directory hierarchy information in a convenient form.
 *
 * For example, if dirMap : DirectoryHierarchyMap, and /foo/bar/baz.c is a file in the
 * directory structure being represented, then
 *
 * dirMap['/foo'] = {'bar': vscode.FileType.Directory}
 * dirMap['/foo/bar'] = {'baz': vscode.FileType.File}
 */
type DirectoryHierarchyMap = Map<string, Map<string, FileType>>;

export type ZipFileReference = {
  sourceArchiveZipPath: string;
  pathWithinSourceArchive: string;
};

/** Encodes a reference to a source file within a zipped source archive into a single URI. */
export function encodeSourceArchiveUri(ref: ZipFileReference): Uri {
  const { sourceArchiveZipPath, pathWithinSourceArchive } = ref;

  // These two paths are put into a single URI with a custom scheme.
  // The path and authority components of the URI encode the two paths.

  // The path component of the URI contains both paths, joined by a slash.
  let encodedPath = path.join(sourceArchiveZipPath, pathWithinSourceArchive);

  // If a URI contains an authority component, then the path component
  // must either be empty or begin with a slash ("/") character.
  // (Source: https://tools.ietf.org/html/rfc3986#section-3.3)
  // Since we will use an authority component, we add a leading slash if necessary
  // (paths on Windows usually start with the drive letter).
  let sourceArchiveZipPathStartIndex: number;
  if (encodedPath.startsWith("/")) {
    sourceArchiveZipPathStartIndex = 0;
  } else {
    encodedPath = `/${encodedPath}`;
    sourceArchiveZipPathStartIndex = 1;
  }

  // The authority component of the URI records the 0-based inclusive start and exclusive end index
  // of the source archive zip path within the path component of the resulting URI.
  // This lets us separate the paths, ignoring the leading slash if we added one.
  const sourceArchiveZipPathEndIndex =
    sourceArchiveZipPathStartIndex + sourceArchiveZipPath.length;
  const authority = `${sourceArchiveZipPathStartIndex}-${sourceArchiveZipPathEndIndex}`;
  return Uri.parse(`${zipArchiveScheme}:/`, true).with({
    path: encodedPath,
    authority,
  });
}

/**
 * Convenience method to create a codeql-zip-archive with a path to the root
 * archive
 *
 * @param pathToArchive the filesystem path to the root of the archive
 */
export function encodeArchiveBasePath(sourceArchiveZipPath: string) {
  return encodeSourceArchiveUri({
    sourceArchiveZipPath,
    pathWithinSourceArchive: "",
  });
}

const sourceArchiveUriAuthorityPattern = /^(\d+)-(\d+)$/;

class InvalidSourceArchiveUriError extends Error {
  constructor(uri: Uri) {
    super(
      `Can't decode uri ${uri}: authority should be of the form startIndex-endIndex (where both indices are integers).`,
    );
  }
}

/** Decodes an encoded source archive URI into its corresponding paths. Inverse of `encodeSourceArchiveUri`. */
export function decodeSourceArchiveUri(uri: Uri): ZipFileReference {
  if (!uri.authority) {
    // Uri is malformed, but this is recoverable
    void extLogger.log(
      `Warning: ${new InvalidSourceArchiveUriError(uri).message}`,
    );
    return {
      pathWithinSourceArchive: "/",
      sourceArchiveZipPath: uri.path,
    };
  }
  const match = sourceArchiveUriAuthorityPattern.exec(uri.authority);
  if (match === null) {
    throw new InvalidSourceArchiveUriError(uri);
  }
  const zipPathStartIndex = parseInt(match[1]);
  const zipPathEndIndex = parseInt(match[2]);
  if (isNaN(zipPathStartIndex) || isNaN(zipPathEndIndex)) {
    throw new InvalidSourceArchiveUriError(uri);
  }
  return {
    pathWithinSourceArchive: uri.path.substring(zipPathEndIndex) || "/",
    sourceArchiveZipPath: uri.path.substring(
      zipPathStartIndex,
      zipPathEndIndex,
    ),
  };
}

/**
 * Make sure `file` and all of its parent directories are represented in `map`.
 */
function ensureFile(map: DirectoryHierarchyMap, file: string) {
  const dirname = path.dirname(file);
  if (dirname === ".") {
    const error = `Ill-formed path ${file} in zip archive (expected absolute path)`;
    void extLogger.log(error);
    throw new Error(error);
  }
  ensureDir(map, dirname);
  map.get(dirname)!.set(path.basename(file), FileType.File);
}

/**
 * Make sure `dir` and all of its parent directories are represented in `map`.
 */
function ensureDir(map: DirectoryHierarchyMap, dir: string) {
  const parent = path.dirname(dir);
  if (!map.has(dir)) {
    map.set(dir, new Map());
    if (dir !== parent) {
      // not the root directory
      ensureDir(map, parent);
      map.get(parent)!.set(path.basename(dir), FileType.Directory);
    }
  }
}

type Archive = {
  zipFile: ZipFile;
  entries: ZipEntry[];
  dirMap: DirectoryHierarchyMap;
};

async function parse_zip(zipPath: string): Promise<Archive> {
  if (!(await pathExists(zipPath))) {
    throw FileSystemError.FileNotFound(zipPath);
  }
  const zipFile = await openZip(zipPath, {
    lazyEntries: true,
    autoClose: false,
    strictFileNames: true,
  });

  const entries = excludeDirectories(await readZipEntries(zipFile));

  const archive: Archive = {
    zipFile,
    entries,
    dirMap: new Map(),
  };

  entries.forEach((f) => {
    ensureFile(archive.dirMap, path.resolve("/", f.fileName));
  });
  return archive;
}

export class ArchiveFileSystemProvider implements FileSystemProvider {
  private readOnlyError = FileSystemError.NoPermissions(
    "write operation attempted, but source archive filesystem is readonly",
  );
  private archives: Map<string, Promise<Archive>> = new Map();

  private async getArchive(zipPath: string): Promise<Archive> {
    if (!this.archives.has(zipPath)) {
      this.archives.set(zipPath, parse_zip(zipPath));
    }
    return await this.archives.get(zipPath)!;
  }

  root = new Directory("");

  flushCache(zipPath: string) {
    this.archives.delete(zipPath);
  }

  // metadata

  async stat(uri: Uri): Promise<FileStat> {
    return await this._lookup(uri);
  }

  async readDirectory(uri: Uri): Promise<Array<[string, FileType]>> {
    const ref = decodeSourceArchiveUri(uri);
    const archive = await this.getArchive(ref.sourceArchiveZipPath);
    const contents = archive.dirMap.get(ref.pathWithinSourceArchive);
    const result =
      contents === undefined ? undefined : Array.from(contents.entries());
    if (result === undefined) {
      throw FileSystemError.FileNotFound(uri);
    }
    return result;
  }

  // file contents

  async readFile(uri: Uri): Promise<Uint8Array> {
    const data = (await this._lookupAsFile(uri)).data;
    if (data) {
      return data;
    }
    throw FileSystemError.FileNotFound();
  }

  // write operations, all disabled

  writeFile(
    _uri: Uri,
    _content: Uint8Array,
    _options: { create: boolean; overwrite: boolean },
  ): void {
    throw this.readOnlyError;
  }

  rename(_oldUri: Uri, _newUri: Uri, _options: { overwrite: boolean }): void {
    throw this.readOnlyError;
  }

  delete(_uri: Uri): void {
    throw this.readOnlyError;
  }

  createDirectory(_uri: Uri): void {
    throw this.readOnlyError;
  }

  // content lookup

  private async _lookup(uri: Uri): Promise<Entry> {
    const ref = decodeSourceArchiveUri(uri);
    const archive = await this.getArchive(ref.sourceArchiveZipPath);

    // this is a path inside the archive, so don't use `.fsPath`, and
    // use '/' as path separator throughout
    const reqPath = ref.pathWithinSourceArchive;

    const file = archive.entries.find((f) => {
      const absolutePath = path.resolve("/", f.fileName);
      return (
        absolutePath === reqPath ||
        absolutePath === path.join("/src_archive", reqPath)
      );
    });
    if (file !== undefined) {
      const buffer = await openZipBuffer(archive.zipFile, file);
      return new File(reqPath, buffer);
    }
    if (archive.dirMap.has(reqPath)) {
      return new Directory(reqPath);
    }
    throw FileSystemError.FileNotFound(
      `uri '${uri.toString()}', interpreted as '${reqPath}' in archive '${
        ref.sourceArchiveZipPath
      }'`,
    );
  }

  private async _lookupAsFile(uri: Uri): Promise<File> {
    const entry = await this._lookup(uri);
    if (entry instanceof File) {
      return entry;
    }
    throw FileSystemError.FileIsADirectory(uri);
  }

  // file events

  private _emitter = new EventEmitter<FileChangeEvent[]>();

  readonly onDidChangeFile: Event<FileChangeEvent[]> = this._emitter.event;

  watch(_resource: Uri): Disposable {
    // ignore, fires for all changes...
    return new Disposable(() => {
      /**/
    });
  }
}

/**
 * Custom uri scheme for referring to files inside zip archives stored
 * in the filesystem. See `encodeSourceArchiveUri`/`decodeSourceArchiveUri` for
 * how these uris are constructed.
 *
 * (cf. https://www.ietf.org/rfc/rfc2396.txt (Appendix A, page 26) for
 * the fact that hyphens are allowed in uri schemes)
 */
export const zipArchiveScheme = "codeql-zip-archive";

export function activate(ctx: ExtensionContext, dbm?: DatabaseManager) {
  const afsp = new ArchiveFileSystemProvider();
  if (dbm) {
    ctx.subscriptions.push(
      dbm.onDidChangeDatabaseItem(async ({ kind, item: db }) => {
        if (kind === DatabaseEventKind.Remove) {
          if (db?.sourceArchive) {
            afsp.flushCache(db.sourceArchive.fsPath);
          }
        }
      }),
    );
  }

  ctx.subscriptions.push(
    // When a file system archive is removed from the workspace, we should
    // also remove it from our cache.
    workspace.onDidChangeWorkspaceFolders((event) => {
      for (const removed of event.removed) {
        const zipPath = removed.uri.fsPath;
        afsp.flushCache(zipPath);
      }
    }),
  );

  ctx.subscriptions.push(
    workspace.registerFileSystemProvider(zipArchiveScheme, afsp, {
      isCaseSensitive: true,
      isReadonly: true,
    }),
  );
}
