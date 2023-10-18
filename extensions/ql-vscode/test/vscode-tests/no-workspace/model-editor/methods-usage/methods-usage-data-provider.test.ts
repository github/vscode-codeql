import { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import {
  CallClassification,
  Method,
} from "../../../../../src/model-editor/method";
import {
  MethodsUsageDataProvider,
  MethodsUsageTreeViewItem,
} from "../../../../../src/model-editor/methods-usage/methods-usage-data-provider";
import { DatabaseItem } from "../../../../../src/databases/local-databases";
import {
  createMethod,
  createUsage,
} from "../../../../factories/model-editor/method-factories";
import { mockedObject } from "../../../utils/mocking.helpers";
import { ModeledMethod } from "../../../../../src/model-editor/modeled-method";
import { Mode } from "../../../../../src/model-editor/shared/mode";

describe("MethodsUsageDataProvider", () => {
  const mockCliServer = mockedObject<CodeQLCliServer>({});
  let dataProvider: MethodsUsageDataProvider;

  beforeEach(() => {
    dataProvider = new MethodsUsageDataProvider(mockCliServer);
  });

  describe("setState", () => {
    const hideModeledMethods = false;
    const mode = Mode.Application;
    const methods: Method[] = [];
    const modeledMethods: Record<string, ModeledMethod[]> = {};
    const modifiedMethodSignatures: Set<string> = new Set();
    const dbItem = mockedObject<DatabaseItem>({
      getSourceLocationPrefix: () => "test",
    });

    it("should not emit onDidChangeTreeData event when state has not changed", async () => {
      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        mode,
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
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods2,
        dbItem,
        hideModeledMethods,
        mode,
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
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods,
        dbItem2,
        hideModeledMethods,
        mode,
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
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods,
        dbItem,
        !hideModeledMethods,
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when modeled methods has changed", async () => {
      const modeledMethods2: Record<string, ModeledMethod[]> = {};

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        mode,
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
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        mode,
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
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        methods2,
        dbItem2,
        !hideModeledMethods,
        mode,
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

    const mode = Mode.Application;
    const methods: Method[] = [supportedMethod, unsupportedMethod];
    const modeledMethods: Record<string, ModeledMethod[]> = {};
    const modifiedMethodSignatures: Set<string> = new Set();

    const dbItem = mockedObject<DatabaseItem>({
      getSourceLocationPrefix: () => "test",
    });

    const usage = createUsage({});

    const methodTreeItem: MethodsUsageTreeViewItem = {
      method: supportedMethod,
      children: [],
    };

    const usageTreeItem: MethodsUsageTreeViewItem = {
      method: supportedMethod,
      usage,
      parent: methodTreeItem,
    };
    methodTreeItem.children = [usageTreeItem];

    it("should return [] if item is a usage", async () => {
      expect(dataProvider.getChildren(usageTreeItem)).toEqual([]);
    });

    it("should return usages if item is method", async () => {
      expect(dataProvider.getChildren(methodTreeItem)).toEqual([usageTreeItem]);
    });

    it("should show all methods if hideModeledMethods is false and looking at the root", async () => {
      const hideModeledMethods = false;
      await dataProvider.setState(
        methods,
        dbItem,
        hideModeledMethods,
        mode,
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
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );
      expect(dataProvider.getChildren().length).toEqual(1);
    });

    describe("with multiple libraries", () => {
      const hideModeledMethods = false;

      describe("in application mode", () => {
        const mode = Mode.Application;
        const methods: Method[] = [
          createMethod({
            library: "b",
            supported: true,
            signature: "b.a.C.a()",
            packageName: "b.a",
            typeName: "C",
            methodName: "a",
            methodParameters: "()",
          }),
          createMethod({
            library: "a",
            supported: true,
            signature: "a.b.C.d()",
            packageName: "a.b",
            typeName: "C",
            methodName: "d",
            methodParameters: "()",
          }),
          createMethod({
            library: "b",
            supported: false,
            signature: "b.a.C.b()",
            packageName: "b.a",
            typeName: "C",
            methodName: "b",
            methodParameters: "()",
            usages: [
              {
                label: "test",
                classification: CallClassification.Source,
                url: {
                  uri: "a/b/",
                  startLine: 1,
                  startColumn: 1,
                  endLine: 1,
                  endColumn: 1,
                },
              },
            ],
          }),
          createMethod({
            library: "b",
            supported: false,
            signature: "b.a.C.d()",
            packageName: "b.a",
            typeName: "C",
            methodName: "d",
            methodParameters: "()",
            usages: [
              {
                label: "test",
                classification: CallClassification.Source,
                url: {
                  uri: "a/b/",
                  startLine: 1,
                  startColumn: 1,
                  endLine: 1,
                  endColumn: 1,
                },
              },
              {
                label: "test",
                classification: CallClassification.Source,
                url: {
                  uri: "a/b/",
                  startLine: 1,
                  startColumn: 1,
                  endLine: 1,
                  endColumn: 1,
                },
              },
            ],
          }),
        ];

        it("should sort methods", async () => {
          await dataProvider.setState(
            methods,
            dbItem,
            hideModeledMethods,
            mode,
            modeledMethods,
            modifiedMethodSignatures,
          );
          expect(
            dataProvider
              .getChildren()
              .map(
                (item) => (item as MethodsUsageTreeViewItem).method.signature,
              ),
          ).toEqual(["b.a.C.d()", "b.a.C.b()", "b.a.C.a()", "a.b.C.d()"]);
          // reasoning for sort order:
          // b.a.C.d() has more usages than b.a.C.b()
          // b.a.C.b() is supported, b.a.C.a() is not
          // b.a.C.a() is in a more unsupported library, a.b.C.d() is in a more supported library
        });
      });
    });
  });
});
