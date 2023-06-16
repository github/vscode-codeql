import { containsPath } from "../pure/files";

/**
 * A set of file paths.
 *
 * All paths in the set will not overlap. If a path is added to the set
 * that is a parent or child of an existing path in the set, only the
 * parent path will be kept.
 */
export class FilePathSet {
  private paths: string[] = [];

  /** Is the set currently empty */
  public isEmpty(): boolean {
    return this.paths.length === 0;
  }

  /**
   * Adds the path to the set.
   *
   * The set will not contain overlapping paths. This means that if the
   * new path is a child of an existing path in the set then it will not
   * be added. And if the new path is a parent of any existing paths, then
   * those existing paths will be removed. This can cause the "size" of
   * the set of decrease, but it won't go from non-zero to zero.
   */
  public addPath(path: string): void {
    if (this.paths.some((p) => containsPath(p, path))) {
      // The new path is a child of an existing path, so don't add it.
      return;
    } else {
      // Remove any existing paths that are children of the new path.
      this.paths = this.paths.filter((p) => !containsPath(path, p));
      this.paths.push(path);
    }
  }

  /** Removes and returns a path from the set, if the set is non-empty. */
  public popPath(): string | undefined {
    return this.paths.shift();
  }
}
