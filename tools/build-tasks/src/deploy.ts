import * as fs from 'fs-extra';
import * as jsonc from 'jsonc-parser';
import { IPackageJson } from '@microsoft/node-core-library';
import * as path from 'path';
import { getRushContext, RushContext } from './rush';
import * as packlist from 'npm-packlist';
import * as glob from 'glob-promise';
import * as cpp from 'child-process-promise';

interface IPackageInfo {
  name: string;
  version: string;
  sourcePath: string;
  files: string[];
  dependencies: IPackageInfo[];
  isRoot?: boolean;
  copied?: boolean;
}

async function copyPackage(packageFiles: IPackageInfo, destPath: string): Promise<void> {
  for (const file of packageFiles.files) {
    await fs.copy(path.resolve(packageFiles.sourcePath, file), path.resolve(destPath, file));
  }
}

export interface DeployedPackage {
  distPath: string;
  name: string;
  version: string;
}

class PackageMap {
  private map = new Map<string, Map<string, IPackageInfo>>();

  constructor() {
  }

  public getPackageInfo(name: string, version: string): IPackageInfo | undefined {
    const versionMap = this.map.get(name);
    if (versionMap === undefined) {
      return undefined;
    }

    return versionMap.get(version);
  }

  public addPackageInfo(pkg: IPackageInfo): void {
    if (this.getPackageInfo(pkg.name, pkg.version)) {
      throw new Error(`Attempt to add duplicate package '${pkg.name}@${pkg.version}'.`);
    }

    let versionMap = this.map.get(pkg.name);
    if (versionMap === undefined) {
      versionMap = new Map<string, IPackageInfo>();
      this.map.set(pkg.name, versionMap);
    }

    versionMap.set(pkg.version, pkg);
  }

  public hasMultipleVersions(name: string): boolean {
    return this.map.get(name)!.size > 1;
  }
}

async function collectPackages(context: RushContext, name: string, version: string,
  pkgs: PackageMap): Promise<IPackageInfo> {

  let pkg = pkgs.getPackageInfo(name, version);
  if (!pkg) {
    const info = await context.getPackageInfo(name, version);

    let files: string[];
    if (info.isLocal) {
      // For local packages, use `packlist` to get the list of files that npm would have packed
      // into the tarball.
      files = packlist.sync({ path: info.path });
    } 
    else {
      // For non-local packages, just copy everything.
      files = await glob('**/*', {
        nodir: true,
        cwd: info.path
      });
    }

    pkg = {
      name: name,
      version: version,
      sourcePath: info.path,
      files: files,
      dependencies: []
    };

    pkgs.addPackageInfo(pkg);

    for (const dependencyName of info.dependencies.keys()) {
      const dependencyVersion = info.dependencies.get(dependencyName)!;

      const dependencyPackage = await collectPackages(context, dependencyName, dependencyVersion, pkgs);
      pkg.dependencies.push(dependencyPackage);
    }
  }

  return pkg;
}

async function copyPackageAndModules(pkg: IPackageInfo, pkgs: PackageMap, destPath: string,
  rootNodeModulesPath: string): Promise<void> {
  
  let destPackagePath: string;
  if (pkgs.hasMultipleVersions(pkg.name) || pkg.isRoot) {
    // Copy as a nested package, and let `npm dedupe` fix it up later if possible.
    destPackagePath = path.join(destPath, pkg.name);
  }
  else {
    // Copy to the root `node_modules` directory.
    if (pkg.copied) {
      return;
    }
    pkg.copied = true;
    destPackagePath = path.join(rootNodeModulesPath, pkg.name);
  }

  await copyPackage(pkg, destPackagePath);
  const nodeModulesPath = path.join(destPackagePath, 'node_modules');
  for (const dependencyPkg of pkg.dependencies) {
    await copyPackageAndModules(dependencyPkg, pkgs, nodeModulesPath, rootNodeModulesPath);
  }
}

export async function deployPackage(packageJsonPath: string): Promise<DeployedPackage> {
  try {
    const context = await getRushContext(path.dirname(packageJsonPath));

    const rootPackage: IPackageJson = jsonc.parse(await fs.readFile(packageJsonPath, 'utf8'));

    const distPath = path.join(context.rushConfig.rushJsonFolder, 'dist', rootPackage.name);
    await fs.remove(distPath);
    await fs.mkdirs(distPath);

    console.log(`Gathering transitive dependencies of package '${rootPackage.name}'...`);
    const pkgs = new PackageMap();
    const rootPkg = await collectPackages(context, rootPackage.name, rootPackage.version, pkgs);
    rootPkg.isRoot = true;

    console.log(`Copying package '${rootPackage.name}' and its dependencies to '${distPath}'...`);
    await copyPackageAndModules(rootPkg, pkgs, path.dirname(distPath), path.join(distPath, 'node_modules'));

    console.log(`Deduplicating dependencies of package '${rootPackage.name}'...`);
    await fs.writeFile(path.join(distPath, 'package-lock.json'), '{}');
    await cpp.spawn('npm', [ 'dedupe' ], {
      cwd: distPath,
      stdio: 'inherit'
    });

    return {
      distPath: distPath,
      name: rootPackage.name,
      version: rootPackage.version
    };
  }
  catch (e) {
    console.error(e);
    throw e;
  }
}
