import { window, TreeView } from "vscode";
import { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import { Method } from "../../../../../src/model-editor/method";
import { MethodsUsagePanel } from "../../../../../src/model-editor/methods-usage/methods-usage-panel";
import { DatabaseItem } from "../../../../../src/databases/local-databases";
import { mockedObject } from "../../../utils/mocking.helpers";
import {
  createMethod,
  createUsage,
} from "../../../../factories/model-editor/method-factories";
import { ModelingStore } from "../../../../../src/model-editor/modeling-store";
import { createMockModelingStore } from "../../../../__mocks__/model-editor/modelingStoreMock";
import { ModeledMethod } from "../../../../../src/model-editor/modeled-method";
import { Mode } from "../../../../../src/model-editor/shared/mode";
import { createMockModelingEvents } from "../../../../__mocks__/model-editor/modelingEventsMock";
import { ModelingEvents } from "../../../../../src/model-editor/modeling-events";

describe("MethodsUsagePanel", () => {
  const mockCliServer = mockedObject<CodeQLCliServer>({});
  const dbItem = mockedObject<DatabaseItem>({
    getSourceLocationPrefix: () => "test",
  });

  describe("setState", () => {
    const hideModeledMethods = false;
    const mode = Mode.Application;
    const methods: Method[] = [createMethod()];
    const modeledMethods: Record<string, ModeledMethod[]> = {};
    const modifiedMethodSignatures: Set<string> = new Set();

    it("should update the tree view with the correct batch number", async () => {
      const mockTreeView = {
        badge: undefined,
      } as TreeView<unknown>;
      jest.spyOn(window, "createTreeView").mockReturnValue(mockTreeView);

      const modelingStore = createMockModelingStore();
      const modelingEvents = createMockModelingEvents();

      const panel = new MethodsUsagePanel(
        modelingStore,
        modelingEvents,
        mockCliServer,
      );
      await panel.setState(
        methods,
        dbItem,
        hideModeledMethods,
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );

      expect(mockTreeView.badge?.value).toBe(1);
    });
  });

  describe("revealItem", () => {
    let mockTreeView: TreeView<unknown>;
    let modelingStore: ModelingStore;
    let modelingEvents: ModelingEvents;

    const hideModeledMethods: boolean = false;
    const mode = Mode.Application;
    const modeledMethods: Record<string, ModeledMethod[]> = {};
    const modifiedMethodSignatures: Set<string> = new Set();
    const usage = createUsage();

    beforeEach(() => {
      mockTreeView = mockedObject<TreeView<unknown>>({
        reveal: jest.fn(),
      });
      jest.spyOn(window, "createTreeView").mockReturnValue(mockTreeView);

      modelingStore = createMockModelingStore();
      modelingEvents = createMockModelingEvents();
    });

    it("should reveal the correct item in the tree view", async () => {
      const method = createMethod({
        usages: [usage],
      });
      const methods = [method];

      const panel = new MethodsUsagePanel(
        modelingStore,
        modelingEvents,
        mockCliServer,
      );
      await panel.setState(
        methods,
        dbItem,
        hideModeledMethods,
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );

      await panel.revealItem(method.signature, usage);

      expect(mockTreeView.reveal).toHaveBeenCalledWith(
        expect.objectContaining({
          method,
          usage,
        }),
      );
    });

    it("should do nothing if usage cannot be found", async () => {
      const method = createMethod({});
      const methods = [method];
      const panel = new MethodsUsagePanel(
        modelingStore,
        modelingEvents,
        mockCliServer,
      );
      await panel.setState(
        methods,
        dbItem,
        hideModeledMethods,
        mode,
        modeledMethods,
        modifiedMethodSignatures,
      );

      await panel.revealItem(method.signature, usage);

      expect(mockTreeView.reveal).not.toHaveBeenCalled();
    });
  });
});
