import { workspace } from "vscode";

import {
  CliConfigListener,
  ConfigListener,
  QueryHistoryConfigListener,
  QueryServerConfigListener,
} from "../../config";

describe("config listeners", () => {
  interface TestConfig<T> {
    clazz: new () => ConfigListener;
    settings: Array<{
      name: string;
      property: string;
      values: [T, T];
    }>;
  }

  const testConfig: Array<TestConfig<string | number | boolean>> = [
    {
      clazz: CliConfigListener,
      settings: [
        {
          name: "codeQL.runningQueries.numberOfThreads",
          property: "numberThreads",
          values: [0, 1],
        },
        {
          name: "codeQL.runningTests.numberOfThreads",
          property: "numberTestThreads",
          values: [1, 0],
        },
        {
          name: "codeQL.runningQueries.maxPaths",
          property: "maxPaths",
          values: [0, 1],
        },
      ],
    },
    {
      clazz: QueryHistoryConfigListener,
      settings: [
        {
          name: "codeQL.queryHistory.format",
          property: "format",
          values: ["abc", "def"],
        },
      ],
    },
    {
      clazz: QueryServerConfigListener,
      settings: [
        {
          name: "codeQL.runningQueries.numberOfThreads",
          property: "numThreads",
          values: [0, 1],
        },
        {
          name: "codeQL.runningQueries.saveCache",
          property: "saveCache",
          values: [false, true],
        },
        {
          name: "codeQL.runningQueries.cacheSize",
          property: "cacheSize",
          values: [0, 1],
        },
        {
          name: "codeQL.runningQueries.memory",
          property: "queryMemoryMb",
          values: [0, 1],
        },
        {
          name: "codeQL.runningQueries.debug",
          property: "debug",
          values: [true, false],
        },
      ],
    },
  ];

  testConfig.forEach((config) => {
    describe(config.clazz.name, () => {
      config.settings.forEach((setting) => {
        let origValue: string | number | boolean | undefined;
        beforeEach(async () => {
          origValue = workspace.getConfiguration().get(setting.name);
          await workspace
            .getConfiguration()
            .update(setting.name, setting.values[0]);
          await wait();
        });

        afterEach(async () => {
          await workspace.getConfiguration().update(setting.name, origValue);
          await wait();
        });

        it(`should listen for changes to '${setting.name}'`, async () => {
          const listener = new config.clazz();
          const onDidChangeConfiguration = jest.fn();
          listener.onDidChangeConfiguration(onDidChangeConfiguration);

          await workspace
            .getConfiguration()
            .update(setting.name, setting.values[1]);
          await wait();
          const newValue = listener[setting.property as keyof typeof listener];
          expect(newValue).toEqual(setting.values[1]);
          expect(onDidChangeConfiguration).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  // Need to wait some time since the onDidChangeConfiguration listeners fire
  // asynchronously and we sometimes need to wait for them to complete in
  // order to have as successful test.
  async function wait(ms = 50) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});
