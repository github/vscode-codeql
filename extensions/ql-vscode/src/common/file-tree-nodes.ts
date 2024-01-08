import { basename, dirname, join } from "path";
import type { EnvironmentContext } from "./app";

/**
 * A node in the tree of files. This will be either a `FileTreeDirectory` or a `FileTreeLeaf`.
 */
export abstract class FileTreeNode<T = undefined> {
  constructor(
    private _path: string,
    private _name: string,
    private _data?: T,
  ) {}

  public get path(): string {
    return this._path;
  }

  public get name(): string {
    return this._name;
  }

  public get data(): T | undefined {
    return this._data;
  }

  public abstract get children(): ReadonlyArray<FileTreeNode<T>>;

  public abstract finish(): void;
}

/**
 * A directory containing one or more files or other directories.
 */
export class FileTreeDirectory<T = undefined> extends FileTreeNode<T> {
  constructor(
    _path: string,
    _name: string,
    protected readonly env: EnvironmentContext,
    private _children: Array<FileTreeNode<T>> = [],
  ) {
    super(_path, _name);
  }

  public get children(): ReadonlyArray<FileTreeNode<T>> {
    return this._children;
  }

  public addChild(child: FileTreeNode<T>): void {
    this._children.push(child);
  }

  public createDirectory(relativePath: string): FileTreeDirectory<T> {
    if (relativePath === ".") {
      return this;
    }
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
      (child) => child instanceof FileTreeLeaf || child.children.length > 0,
    );
    this._children.sort((a, b) =>
      a.name.localeCompare(b.name, this.env.language),
    );
    this._children.forEach((child, i) => {
      child.finish();
      if (
        child.children?.length === 1 &&
        child.children[0] instanceof FileTreeDirectory
      ) {
        // collapse children
        const replacement = new FileTreeDirectory<T>(
          child.children[0].path,
          `${child.name} / ${child.children[0].name}`,
          this.env,
          Array.from(child.children[0].children),
        );
        this._children[i] = replacement;
      }
    });
  }

  private createChildDirectory(name: string): FileTreeDirectory<T> {
    const existingChild = this._children.find((child) => child.name === name);
    if (existingChild !== undefined) {
      return existingChild as FileTreeDirectory<T>;
    } else {
      const newChild = new FileTreeDirectory<T>(
        join(this.path, name),
        name,
        this.env,
      );
      this.addChild(newChild);
      return newChild;
    }
  }
}

/**
 * A single file.
 */
export class FileTreeLeaf<T = undefined> extends FileTreeNode<T> {
  constructor(_path: string, _name: string, _data?: T) {
    super(_path, _name, _data);
  }

  public get children(): ReadonlyArray<FileTreeNode<T>> {
    return [];
  }

  public finish(): void {
    /**/
  }
}
