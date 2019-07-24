export interface PackageDependencies {
  [key: string]: string;
}

export interface ShrinkwrapPackage {
  dependencies?: PackageDependencies;
  dev?: boolean;
  name?: string;
  version?: string;
}

export interface Shrinkwrap {
  dependencies: PackageDependencies;
  packages: {
    [key: string]: ShrinkwrapPackage;
  }
}
