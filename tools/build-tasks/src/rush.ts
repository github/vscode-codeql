import * as fs from 'fs-extra';
import * as glob from 'glob-promise';
import * as jsonc from 'jsonc-parser';
import { Shrinkwrap, ShrinkwrapPackage } from './pnpm';
import * as path from 'path';
import { IPackageJson } from '@microsoft/node-core-library';
import { RushConfiguration } from '@microsoft/rush-lib';
import * as yaml from 'js-yaml';

export interface IPackageJsonWithFiles extends IPackageJson {
  files?: string[]
}

interface PackageInfo {
  path: string;
  dependencies: Map<string, string>;
  config: IPackageJsonWithFiles;
  isLocal: boolean;
}

const peerDependencyVersionPattern = /^\/((?:@(?:[^\/]+)\/)?[^\/]+)\/([^\/]+)\//;

export class RushContext {
  private shrinkwrap?: Shrinkwrap;
  private shrinkwrapPackages?: Map<string, ShrinkwrapPackage>;
  private readonly packageStore: string;

  constructor(public readonly rushConfig: RushConfiguration) {
    this.packageStore = path.normalize(path.join(
      rushConfig.pnpmOptions.pnpmStorePath,
      "..",
      "node_modules",
      ".pnpm"
    ));
  }

  private async findPackageInRepository(name: string, version: string): Promise<string> {
    // See https://pnpm.js.org/en/symlinked-node-modules-structure for how packages are laid out
    // note that this will fail if we ever get into a situation where we have multiple versions
    // of the same package due to peer dependencies.
    // For more information on that, see https://pnpm.js.org/en/how-peers-are-resolved
    const results = await glob(`${name}@${version}*/node_modules/${name}`, {
      absolute: true,
      cwd: this.packageStore
    });
    if (results.length === 0) {
      throw new Error(
        `Package '${name}:${version}' not found in package repository located at ${this.packageStore}`
      );
    }
    else if (results.length > 1) {
      throw new Error(
        `Multiple copies of package '${name}:${version}' found in package repository at ${this.packageStore}: ${results}`
      );
    }
    else {
      return results[0];
    }
  }

  private getRushProjectPath(name: string): string | undefined {
    const project = this.rushConfig.getProjectByName(name);
    if (project) {
      return project.projectFolder;
    }
    else {
      return undefined;
    }
  }

  private async getShrinkwrap(): Promise<Shrinkwrap> {
    if (!this.shrinkwrap) {
      this.shrinkwrap = yaml.safeLoad(await fs.readFile(this.rushConfig.getCommittedShrinkwrapFilename(), 'utf8'));
    }

    return this.shrinkwrap!;
  }

  private async getShrinkwrapPackage(name: string, version: string): Promise<ShrinkwrapPackage> {
    const shrinkwrap = await this.getShrinkwrap();

    if (!this.shrinkwrapPackages) {
      this.shrinkwrapPackages = new Map<string, ShrinkwrapPackage>();
      for (const name in shrinkwrap.packages) {
        const pkg = shrinkwrap.packages[name];
        let packageKey: string;
        if (pkg.name) {
          packageKey = makePackageKey(pkg.name, pkg.version!);
        }
        else {
          packageKey = name;
        }
        this.shrinkwrapPackages.set(packageKey, pkg);
      }
    }

    const packageKey = makePackageKey(name, version);
    const shrinkwrapPackage = this.shrinkwrapPackages.get(packageKey);
    if (!shrinkwrapPackage) {
      throw new Error(`Package '${packageKey}' not found in shrinkwrap file.`);
    }
    return shrinkwrapPackage;
  }

  public async getPackageInfo(name: string, version: string): Promise<PackageInfo> {
    let pkg: ShrinkwrapPackage;
    const rushProject = this.rushConfig.getProjectByName(name);
    let packagePath: string;
    let config: IPackageJsonWithFiles;
    if (rushProject) {
      packagePath = rushProject.projectFolder;
      pkg = await this.getShrinkwrapPackage(rushProject.tempProjectName, '0.0.0');
      config = rushProject.packageJson;
    }
    else {
      pkg = await this.getShrinkwrapPackage(name, version);
      // Ensure a proper version number. pnpm uses syntax like 3.4.0_glob@7.1.6 for peer dependencies
      version = version.split('_')[0];
      packagePath = await this.findPackageInRepository(name, version);
      packagePath = await fs.realpath(packagePath);
      config = jsonc.parse(await fs.readFile(path.join(packagePath, 'package.json'), 'utf8'));
    }

    const dependencies = new Map<string, string>();
    if (config.dependencies) {
      for (const dependencyName in config.dependencies) {
        let dependencyVersion: string;
        if (await this.getRushProjectPath(dependencyName)) {
          dependencyVersion = '0.0.0';
        }
        else {
          dependencyVersion = pkg.dependencies![dependencyName];
          if (!dependencyVersion) {
            throw new Error(`Package '${name}' depends on unresolved package '${dependencyName}'.`);
          }
          if (dependencyVersion.startsWith('/')) {
            // This is a package with a peer dependency. We need to extract the actual package
            // version.
            const match = dependencyVersion.match(peerDependencyVersionPattern);
            if (match) {
              if (match[1] !== dependencyName) {
                throw new Error(`Mismatch between package name '${dependencyName}' and peer dependency specifier '${dependencyVersion}'.`);
              }
              dependencyVersion = match[2];
            }
            else {
              throw new Error(`Invalid peer dependency specifier '${dependencyVersion}'.`);
            }
          }
        }

        dependencies.set(dependencyName, dependencyVersion);
      }
    }

    return {
      path: packagePath,
      dependencies: dependencies,
      config: config,
      isLocal: rushProject !== undefined
    };
  }
}

function makePackageKey(name: string, version: string): string {
  return `/${name}/${version}`;
}

export async function getRushContext(startingFolder?: string): Promise<RushContext> {
  const rushConfig = RushConfiguration.loadFromDefaultLocation({
    startingFolder: startingFolder
  });

  return new RushContext(rushConfig);
}
