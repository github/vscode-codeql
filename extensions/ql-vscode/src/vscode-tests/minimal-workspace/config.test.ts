import * as Sinon from "sinon";
import { expect } from "chai";
import { workspace } from "vscode";

import {
  CliConfigListener,
  QueryHistoryConfigListener,
  QueryServerConfigListener,
} from "../../config";

describe("config listeners", function () {
  // Because we are adding some extra waiting, need to bump the test timeouts.
  this.timeout(5000);

  let sandbox: Sinon.SinonSandbox;
  beforeEach(() => {
    sandbox = Sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  interface TestConfig<T> {
    clazz: new () => unknown;
    settings: {
      name: string;
      property: string;
      values: [T, T];
    }[];
  }

  const testConfig: TestConfig<string | number | boolean>[] = [
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
      let listener: any;
      let spy: Sinon.SinonSpy;
      beforeEach(() => {
        listener = new config.clazz();
        spy = Sinon.spy();
        listener.onDidChangeConfiguration(spy);
      });

      config.settings.forEach((setting) => {
        let origValue: any;
        beforeEach(async () => {
          origValue = workspace.getConfiguration().get(setting.name);
          await workspace
            .getConfiguration()
            .update(setting.name, setting.values[0]);
          await wait();
          spy.resetHistory();
        });

        afterEach(async () => {
          await workspace.getConfiguration().update(setting.name, origValue);
          await wait();
        });

        it(`should listen for changes to '${setting.name}'`, async () => {
          await workspace
            .getConfiguration()
            .update(setting.name, setting.values[1]);
          await wait();
          expect(listener[setting.property]).to.eq(setting.values[1]);
          expect(spy).to.have.been.calledOnce;
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
