import { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import { Method } from "../../../../../src/model-editor/method";
import { MethodsUsageDataProvider } from "../../../../../src/model-editor/methods-usage/methods-usage-data-provider";
import { DatabaseItem } from "../../../../../src/databases/local-databases";
import {
  createMethod,
  createUsage,
} from "../../../../factories/data-extension/method-factories";
import { mockedObject } from "../../../utils/mocking.helpers";

describe("MethodsUsageDataProvider", () => {
  const mockCliServer = mockedObject<CodeQLCliServer>({});
  let dataProvider: MethodsUsageDataProvider;

  beforeEach(() => {
    dataProvider = new MethodsUsageDataProvider(mockCliServer);
  });

  describe("setState", () => {
    const hideModeledApis = false;
    const methods: Method[] = [];
    const dbItem = mockedObject<DatabaseItem>({
      getSourceLocationPrefix: () => "test",
    });

    it("should not emit onDidChangeTreeData event when state has not changed", async () => {
      await dataProvider.setState(methods, dbItem, hideModeledApis);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(methods, dbItem, hideModeledApis);

      expect(onDidChangeTreeDataListener).not.toHaveBeenCalled();
    });

    it("should emit onDidChangeTreeData event when methods has changed", async () => {
      const methods2: Method[] = [];

      await dataProvider.setState(methods, dbItem, hideModeledApis);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(methods2, dbItem, hideModeledApis);

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when dbItem has changed", async () => {
      const dbItem2 = mockedObject<DatabaseItem>({
        getSourceLocationPrefix: () => "test",
      });

      await dataProvider.setState(methods, dbItem, hideModeledApis);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(methods, dbItem2, hideModeledApis);

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when hideModeledApis has changed", async () => {
      await dataProvider.setState(methods, dbItem, hideModeledApis);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(methods, dbItem, !hideModeledApis);

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when all entries have changed", async () => {
      const dbItem2 = mockedObject<DatabaseItem>({
        getSourceLocationPrefix: () => "test",
      });
      const methods2: Method[] = [];

      await dataProvider.setState(methods, dbItem, hideModeledApis);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(methods2, dbItem2, !hideModeledApis);

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("getChildren", () => {
    const supportedMethod = createMethod({
      supported: true,
    });

    const unsupportedMethod = createMethod({
      supported: false,
    });

    const methods: Method[] = [supportedMethod, unsupportedMethod];
    const dbItem = mockedObject<DatabaseItem>({
      getSourceLocationPrefix: () => "test",
    });

    const usage = createUsage({});

    it("should return [] if item is a usage", async () => {
      expect(dataProvider.getChildren(usage)).toEqual([]);
    });

    it("should return usages if item is external api usage", async () => {
      const method = createMethod({ usages: [usage] });
      expect(dataProvider.getChildren(method)).toEqual([usage]);
    });

    it("should show all methods if hideModeledApis is false and looking at the root", async () => {
      const hideModeledApis = false;
      await dataProvider.setState(methods, dbItem, hideModeledApis);
      expect(dataProvider.getChildren().length).toEqual(2);
    });

    it("should filter methods if hideModeledApis is true and looking at the root", async () => {
      const hideModeledApis = true;
      await dataProvider.setState(methods, dbItem, hideModeledApis);
      expect(dataProvider.getChildren().length).toEqual(1);
    });
  });
});
