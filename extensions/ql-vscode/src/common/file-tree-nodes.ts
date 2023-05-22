import { basename, dirname, join } from "path";
import { env } from "vscode";

/**
 * A node in the tree of files. This will be either a `FileTreeDirectory` or a `FileTreeLeaf`.
 */
export abstract class FileTreeNode {
  constructor(private _path: string, private _name: string) {}

  public get path(): string {
    return this._path;
  }

  public get name(): string {
    return this._name;
  }

  public abstract get children(): readonly FileTreeNode[];

  public abstract finish(): void;
}

/**
 * A directory containing one or more files or other directories.
 */
export class FileTreeDirectory extends FileTreeNode {
  constructor(
    _path: string,
    _name: string,
    private _children: FileTreeNode[] = [],
  ) {
    super(_path, _name);
  }

  public get children(): readonly FileTreeNode[] {
    return this._children;
  }

  public addChild(child: FileTreeNode): void {
    this._children.push(child);
  }

  public createDirectory(relativePath: string): FileTreeDirectory {
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
    this._children.sort((a, b) => a.name.localeCompare(b.name, env.language));
    this._children.forEach((child, i) => {
      child.finish();
      if (
        child.children?.length === 1 &&
        child.children[0] instanceof FileTreeDirectory
      ) {
        // collapse children
        const replacement = new FileTreeDirectory(
          child.children[0].path,
          `${child.name} / ${child.children[0].name}`,
          Array.from(child.children[0].children),
        );
        this._children[i] = replacement;
      }
    });
  }

  private createChildDirectory(name: string): FileTreeDirectory {
    const existingChild = this._children.find((child) => child.name === name);
    if (existingChild !== undefined) {
      return existingChild as FileTreeDirectory;
    } else {
      const newChild = new FileTreeDirectory(join(this.path, name), name);
      this.addChild(newChild);
      return newChild;
    }
  }
}

/**
 * A single file.
 */
export class FileTreeLeaf extends FileTreeNode {
  constructor(_path: string, _name: string) {
    super(_path, _name);
  }

  public get children(): readonly FileTreeNode[] {
    return [];
  }

  public finish(): void {
    /**/
  }
}
