/**
 * A node in the tree of queries. This will be either a `QueryDirectory` or a `QueryFile`.
 */
export abstract class QueryNode {
  constructor(private _path: string, private _name: string) {}

  public get path(): string {
    return this._path;
  }

  public get name(): string {
    return this._name;
  }

  public abstract get children(): readonly QueryNode[];
}

/**
 * A directory containing one or more query files or other query directories.
 */
export class QueryDirectory extends QueryNode {
  constructor(
    _path: string,
    _name: string,
    private _children: QueryNode[] = [],
  ) {
    super(_path, _name);
  }

  public get children(): readonly QueryNode[] {
    return this._children;
  }

  public addChild(child: QueryNode): void {
    this._children.push(child);
  }
}

/**
 * A single query file, i.e. a file with `.ql` extension.
 */
export class QueryFile extends QueryNode {
  constructor(_path: string, _name: string) {
    super(_path, _name);
  }

  public get children(): readonly QueryNode[] {
    return [];
  }
}
