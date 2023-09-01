import { window, TreeView } from "vscode";
import { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import { ExternalApiUsage } from "../../../../../src/model-editor/external-api-usage";
import { MethodsUsagePanel } from "../../../../../src/model-editor/methods-usage/methods-usage-panel";
import { DatabaseItem } from "../../../../../src/databases/local-databases";
import { mockedObject } from "../../../utils/mocking.helpers";
import {
  createExternalApiUsage,
  createUsage,
} from "../../../../factories/data-extension/external-api-factories";

describe("MethodsUsagePanel", () => {
  const mockCliServer = mockedObject<CodeQLCliServer>({});
  const dbItem = mockedObject<DatabaseItem>({
    getSourceLocationPrefix: () => "test",
  });

  describe("setState", () => {
    const hideModeledApis = false;
    const externalApiUsages: ExternalApiUsage[] = [createExternalApiUsage()];

    it("should update the tree view with the correct batch number", async () => {
      const mockTreeView = {
        badge: undefined,
      } as TreeView<unknown>;
      jest.spyOn(window, "createTreeView").mockReturnValue(mockTreeView);

      const panel = new MethodsUsagePanel(mockCliServer);
      await panel.setState(externalApiUsages, dbItem, hideModeledApis);

      expect(mockTreeView.badge?.value).toBe(1);
    });
  });

  describe("revealItem", () => {
    let mockTreeView: TreeView<unknown>;

    const hideModeledApis: boolean = false;
    const usage = createUsage();

    beforeEach(() => {
      mockTreeView = mockedObject<TreeView<unknown>>({
        reveal: jest.fn(),
      });
      jest.spyOn(window, "createTreeView").mockReturnValue(mockTreeView);
    });

    it("should reveal the correct item in the tree view", async () => {
      const externalApiUsages = [
        createExternalApiUsage({
          usages: [usage],
        }),
      ];

      const panel = new MethodsUsagePanel(mockCliServer);
      await panel.setState(externalApiUsages, dbItem, hideModeledApis);

      await panel.revealItem(usage);

      expect(mockTreeView.reveal).toHaveBeenCalledWith(usage);
    });

    it("should do nothing if usage cannot be found", async () => {
      const externalApiUsages = [createExternalApiUsage({})];
      const panel = new MethodsUsagePanel(mockCliServer);
      await panel.setState(externalApiUsages, dbItem, hideModeledApis);

      await panel.revealItem(usage);

      expect(mockTreeView.reveal).not.toHaveBeenCalled();
    });
  });
});
