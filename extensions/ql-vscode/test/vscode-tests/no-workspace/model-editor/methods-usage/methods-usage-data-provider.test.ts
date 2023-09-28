import { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import { Method } from "../../../../../src/model-editor/method";
import { MethodsUsageDataProvider } from "../../../../../src/model-editor/methods-usage/methods-usage-data-provider";
import { DatabaseItem } from "../../../../../src/databases/local-databases";
import {
  createMethod,
  createUsage,
} from "../../../../factories/model-editor/method-factories";
import { mockedObject } from "../../../utils/mocking.helpers";
import { ModeledMethod } from "../../../../../src/model-editor/modeled-method";

describe("MethodsUsageDataProvider", () => {
  const mockCliServer = mockedObject<CodeQLCliServer>({});
  let dataProvider: MethodsUsageDataProvider;

  beforeEach(() => {
    dataProvider = new MethodsUsageDataProvider(mockCliServer);
  });

  describe("setState", () => {
    const hideModeledMethods = false;
    const methods: Method[] = [];
    const modeledMethods: Record<string, ModeledMethod> = {};
    const modifiedMethodSignatures: Set<string> = new Set();
    const dbItem = mockedObject<DatabaseItem>({
      getSourceLocationPrefix: () => "test",
    });

    it("should not emit onDidChangeTreeData event when state has not changed", async () => {
      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

      expect(onDidChangeTreeDataListener).not.toHaveBeenCalled();
    });

    it("should emit onDidChangeTreeData event when methods has changed", async () => {
      const methods2: Method[] = [];

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods2,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when dbItem has changed", async () => {
      const dbItem2 = mockedObject<DatabaseItem>({
        getSourceLocationPrefix: () => "test",
      });

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods,
        dbItem2,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when hideModeledMethods has changed", async () => {
      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods,
        dbItem,
        !hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when modeled methods has changed", async () => {
      const modeledMethods2: Record<string, ModeledMethod> = {};

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods2,
        modifiedMethodSignatures,
      );

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when modified method signatures has changed", async () => {
      const modifiedMethodSignatures2: Set<string> = new Set();

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures2,
      );

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when all entries have changed", async () => {
      const dbItem2 = mockedObject<DatabaseItem>({
        getSourceLocationPrefix: () => "test",
      });
      const methods2: Method[] = [];

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods2,
        dbItem2,
        !hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );

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
    const modeledMethods: Record<string, ModeledMethod> = {};
    const modifiedMethodSignatures: Set<string> = new Set();

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

    it("should show all methods if hideModeledMethods is false and looking at the root", async () => {
      const hideModeledMethods = false;
      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );
      expect(dataProvider.getChildren().length).toEqual(2);
    });

    it("should filter methods if hideModeledMethods is true and looking at the root", async () => {
      const hideModeledMethods = true;
      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        modeledMethods,
        modifiedMethodSignatures,
      );
      expect(dataProvider.getChildren().length).toEqual(1);
    });
  });
});
