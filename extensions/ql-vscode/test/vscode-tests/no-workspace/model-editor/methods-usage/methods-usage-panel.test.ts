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

describe("MethodsUsagePanel", () => {
  const mockCliServer = mockedObject<CodeQLCliServer>({});
  const dbItem = mockedObject<DatabaseItem>({
    getSourceLocationPrefix: () => "test",
  });

  describe("setState", () => {
    const hideModeledMethods = false;
    const methods: Method[] = [createMethod()];

    it("should update the tree view with the correct batch number", async () => {
      const mockTreeView = {
        badge: undefined,
      } as TreeView<unknown>;
      jest.spyOn(window, "createTreeView").mockReturnValue(mockTreeView);

      const panel = new MethodsUsagePanel(mockCliServer);
      await panel.setState(methods, dbItem, hideModeledMethods);

      expect(mockTreeView.badge?.value).toBe(1);
    });
  });

  describe("revealItem", () => {
    let mockTreeView: TreeView<unknown>;

    const hideModeledMethods: boolean = false;
    const usage = createUsage();

    beforeEach(() => {
      mockTreeView = mockedObject<TreeView<unknown>>({
        reveal: jest.fn(),
      });
      jest.spyOn(window, "createTreeView").mockReturnValue(mockTreeView);
    });

    it("should reveal the correct item in the tree view", async () => {
      const methods = [
        createMethod({
          usages: [usage],
        }),
      ];

      const panel = new MethodsUsagePanel(mockCliServer);
      await panel.setState(methods, dbItem, hideModeledMethods);

      await panel.revealItem(usage);

      expect(mockTreeView.reveal).toHaveBeenCalledWith(usage);
    });

    it("should do nothing if usage cannot be found", async () => {
      const methods = [createMethod({})];
      const panel = new MethodsUsagePanel(mockCliServer);
      await panel.setState(methods, dbItem, hideModeledMethods);

      await panel.revealItem(usage);

      expect(mockTreeView.reveal).not.toHaveBeenCalled();
    });
  });
});
