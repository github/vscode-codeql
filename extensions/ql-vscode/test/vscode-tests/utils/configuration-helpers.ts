import { workspace } from "vscode";

type MockConfigurationConfig = {
  values: {
    [section: string]: {
      [scope: string]: any | (() => any);
    };
  };
};

export function mockConfiguration(config: MockConfigurationConfig) {
  const originalGetConfiguration = workspace.getConfiguration;

  jest
    .spyOn(workspace, "getConfiguration")
    .mockImplementation((section, scope) => {
      const configuration = originalGetConfiguration(section, scope);

      return {
        get(key: string, defaultValue?: unknown) {
          if (
            section &&
            config.values[section] &&
            config.values[section][key]
          ) {
            const value = config.values[section][key];
            return typeof value === "function" ? value() : value;
          }

          return configuration.get(key, defaultValue);
        },
        has(key: string) {
          return configuration.has(key);
        },
        inspect(key: string) {
          return configuration.inspect(key);
        },
        update(
          key: string,
          value: unknown,
          configurationTarget?: boolean,
          overrideInLanguage?: boolean,
        ) {
          return configuration.update(
            key,
            value,
            configurationTarget,
            overrideInLanguage,
          );
        },
      };
    });
}
