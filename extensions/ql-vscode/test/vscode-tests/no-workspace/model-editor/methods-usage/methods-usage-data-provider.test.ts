import type { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import type { Method } from "../../../../../src/model-editor/method";
import { CallClassification } from "../../../../../src/model-editor/method";
import type { MethodsUsageTreeViewItem } from "../../../../../src/model-editor/methods-usage/methods-usage-data-provider";
import { MethodsUsageDataProvider } from "../../../../../src/model-editor/methods-usage/methods-usage-data-provider";
import type { DatabaseItem } from "../../../../../src/databases/local-databases";
import {
  createMethod,
  createUsage,
} from "../../../../factories/model-editor/method-factories";
import { mockedObject } from "../../../utils/mocking.helpers";
import type { ModeledMethod } from "../../../../../src/model-editor/modeled-method";
import { Mode } from "../../../../../src/model-editor/shared/mode";
import { createSinkModeledMethod } from "../../../../factories/model-editor/modeled-method-factories";

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
    const supportedUnmodeledMethod = createMethod({
      signature: "some.supported.unmodeled.method()",
      supported: true,
    });
    const supportedModeledMethod = createMethod({
      signature: "some.supported.modeled.method()",
      supported: true,
    });
    const unsupportedUnmodeledMethod = createMethod({
      signature: "some.unsupported.unmodeled.method()",
      supported: false,
    });
    const unsupportedModeledMethod = createMethod({
      signature: "some.unsupported.modeled.method()",
      supported: false,
    });

    const mode = Mode.Application;
    const methods: Method[] = [
      supportedUnmodeledMethod,
      supportedModeledMethod,
      unsupportedUnmodeledMethod,
      unsupportedModeledMethod,
    ];
    const modeledMethods: Record<string, ModeledMethod[]> = {};
    modeledMethods[supportedModeledMethod.signature] = [
      createSinkModeledMethod(),
    ];
    modeledMethods[unsupportedModeledMethod.signature] = [
      createSinkModeledMethod(),
    ];
    const modifiedMethodSignatures: Set<string> = new Set();

    const dbItem = mockedObject<DatabaseItem>({
      getSourceLocationPrefix: () => "test",
    });

    const usage = createUsage({});

    const methodTreeItem: MethodsUsageTreeViewItem = {
      method: unsupportedUnmodeledMethod,
      children: [],
    };

    const usageTreeItem: MethodsUsageTreeViewItem = {
      method: unsupportedUnmodeledMethod,
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
      expect(dataProvider.getChildren().length).toEqual(4);
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
      expect(dataProvider.getChildren().length).toEqual(3);
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
                  type: "lineColumnLocation",
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
                  type: "lineColumnLocation",
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
                  type: "lineColumnLocation",
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

        it("should not change sort methods of methods", async () => {
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
          ).toEqual(["b.a.C.a()", "b.a.C.b()", "b.a.C.d()", "a.b.C.d()"]);
        });
      });
    });
  });
});
