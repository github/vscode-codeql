import type {
  ConfigurationScope,
  WorkspaceConfiguration as VSCodeWorkspaceConfiguration,
} from "vscode";
import { ConfigurationTarget, workspace, Uri } from "vscode";
import { readFileSync } from "fs-extra";
import { join } from "path";

function getIn(object: any, path: string): any {
  const parts = path.split(".");
  let current = object;
  for (const part of parts) {
    current = current[part];
    if (current === undefined) {
      return undefined;
    }
  }
  return current;
}

function setIn(object: any, path: string, value: any): void {
  const parts = path.split(".");
  let current = object;
  for (const part of parts.slice(0, -1)) {
    if (current[part] === undefined) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

interface WorkspaceConfiguration {
  scope?: ConfigurationTarget;

  get<T>(section: string | undefined, key: string): T | undefined;
  has(section: string | undefined, key: string): boolean;
  update(section: string | undefined, key: string, value: unknown): void;
}

class InMemoryConfiguration implements WorkspaceConfiguration {
  private readonly values: Record<string, unknown> = {};

  public constructor(public readonly scope: ConfigurationTarget) {}

  public get<T>(section: string | undefined, key: string): T | undefined {
    return getIn(this.values, this.getKey(section, key)) as T | undefined;
  }

  public has(section: string | undefined, key: string): boolean {
    return getIn(this.values, this.getKey(section, key)) !== undefined;
  }

  public update(
    section: string | undefined,
    key: string,
    value: unknown,
  ): void {
    setIn(this.values, this.getKey(section, key), value);
  }

  private getKey(section: string | undefined, key: string): string {
    return section ? `${section}.${key}` : key;
  }
}

class DefaultConfiguration implements WorkspaceConfiguration {
  private readonly values: Record<string, unknown> = {};

  public constructor(configurations: PackageConfiguration) {
    for (const [section, config] of Object.entries(configurations)) {
      setIn(this.values, section, config.default);
    }
  }

  public get<T>(section: string | undefined, key: string): T | undefined {
    return getIn(this.values, this.getKey(section, key)) as T | undefined;
  }

  public has(section: string | undefined, key: string): boolean {
    return getIn(this.values, this.getKey(section, key)) !== undefined;
  }

  public update(
    _section: string | undefined,
    _key: string,
    _value: unknown,
  ): void {
    throw new Error("Cannot update default configuration");
  }

  private getKey(section: string | undefined, key: string): string {
    return section ? `${section}.${key}` : key;
  }
}

class ChainedInMemoryConfiguration {
  constructor(private readonly configurations: WorkspaceConfiguration[]) {}

  public getConfiguration(target: ConfigurationTarget) {
    const configuration = this.configurations.find(
      (configuration) => configuration.scope === target,
    );

    if (configuration === undefined) {
      throw new Error(`Unknown configuration target ${target}`);
    }

    return configuration;
  }

  public get<T>(section: string | undefined, key: string): T | undefined {
    for (const configuration of this.configurations) {
      if (configuration.has(section, key)) {
        return configuration.get(section, key);
      }
    }
    return undefined;
  }

  public has(section: string | undefined, key: string): boolean {
    return this.configurations.some((configuration) =>
      configuration.has(section, key),
    );
  }

  public update<T>(
    section: string | undefined,
    key: string,
    value: T,
    target: ConfigurationTarget,
  ): void {
    const configuration = this.getConfiguration(target);

    configuration.update(section, key, value);
  }
}

type PackageConfiguration = Record<
  string,
  {
    default: unknown;
  }
>;

// Public configuration keys are the ones defined in the package.json.
// These keys are documented in the settings page. Other keys are
// internal and not documented.
const packageConfiguration: PackageConfiguration =
  (function initConfigurationKeys() {
    // Note we are using synchronous file reads here. This is fine because
    // we are in tests.
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "../../package.json"), "utf-8"),
    );

    const properties: PackageConfiguration = {
      // `debug.saveBeforeStart` is a core VS Code setting, but we depend on its value in these tests.
      // We'll set it here to the value that we expect.
      "debug.saveBeforeStart": {
        default: "nonUntitledEditorsInActiveGroup",
      },
    };
    if (!Array.isArray(pkg.contributes.configuration)) {
      throw new Error("Expected package.json configuration to be an array");
    }
    for (const configuration of pkg.contributes.configuration) {
      if (configuration.properties) {
        for (const [key, value] of Object.entries(configuration.properties)) {
          properties[key] = value as any;
        }
      }
    }

    return properties;
  })();

// eslint-disable-next-line import/no-mutable-exports
export let vscodeGetConfigurationMock: jest.SpiedFunction<
  typeof workspace.getConfiguration
>;

function acceptScope(scope: ConfigurationScope | null | undefined): boolean {
  if (!scope) {
    return true;
  }

  if (scope instanceof Uri) {
    return false;
  }

  // Reject any scope that has a URI property. That covers `WorkspaceFolder`, `TextDocument`, and any
  if (scope.uri !== undefined) {
    return false;
  }

  // We're left with only `{ languageId }` scopes. We'll ignore the language, since it doesn't matter
  // for our tests.
  return true;
}

export const beforeEachAction = async () => {
  const defaultConfiguration = new DefaultConfiguration(packageConfiguration);

  const configuration = new ChainedInMemoryConfiguration([
    new InMemoryConfiguration(ConfigurationTarget.WorkspaceFolder),
    new InMemoryConfiguration(ConfigurationTarget.Workspace),
    new InMemoryConfiguration(ConfigurationTarget.Global),
    defaultConfiguration,
  ]);

  vscodeGetConfigurationMock = jest
    .spyOn(workspace, "getConfiguration")
    .mockImplementation(
      (
        section?: string,
        scope?: ConfigurationScope | null,
      ): VSCodeWorkspaceConfiguration => {
        if (!acceptScope(scope)) {
          throw new Error("Scope is not supported in tests");
        }

        return {
          get(key: string, defaultValue?: unknown) {
            return configuration.get(section, key) ?? defaultValue;
          },
          has(key: string) {
            return configuration.has(section, key);
          },
          inspect(_key: string) {
            throw new Error("inspect is not supported in tests");
          },
          async update(
            key: string,
            value: unknown,
            configurationTarget?: ConfigurationTarget | boolean | null,
            overrideInLanguage?: boolean,
          ) {
            if (overrideInLanguage) {
              throw new Error("overrideInLanguage is not supported in tests");
            }

            function getActualConfigurationTarget(): ConfigurationTarget {
              if (
                configurationTarget === undefined ||
                configurationTarget === null
              ) {
                return ConfigurationTarget.Global;
              }
              if (typeof configurationTarget === "boolean") {
                return configurationTarget
                  ? ConfigurationTarget.Workspace
                  : ConfigurationTarget.Global;
              }
              return configurationTarget;
            }

            const target = getActualConfigurationTarget();

            configuration.update(section, key, value, target);
          },
        };
      },
    );
};
