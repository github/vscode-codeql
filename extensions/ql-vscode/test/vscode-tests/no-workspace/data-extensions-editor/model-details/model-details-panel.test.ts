import { window, TreeView } from "vscode";
import { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import { ExternalApiUsage } from "../../../../../src/data-extensions-editor/external-api-usage";
import { ModelDetailsPanel } from "../../../../../src/data-extensions-editor/model-details/model-details-panel";
import { DatabaseItem } from "../../../../../src/databases/local-databases";
import { mockedObject } from "../../../utils/mocking.helpers";
import {
  createExternalApiUsage,
  createUsage,
} from "../../../../factories/data-extension/external-api-factories";

describe("ModelDetailsPanel", () => {
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

      const panel = new ModelDetailsPanel(mockCliServer);
      await panel.setState(externalApiUsages, dbItem, hideModeledApis);

      expect(mockTreeView.badge?.value).toBe(1);
    });
  });

  describe("revealItem", () => {
    let mockTreeView: TreeView<unknown>;

    const hideModeledApis: boolean = false;
    const usage = createUsage();

    beforeEach(() => {
      mockTreeView = {
        reveal: jest.fn(),
      } as unknown as TreeView<unknown>;
      jest.spyOn(window, "createTreeView").mockReturnValue(mockTreeView);
    });

    it("should reveal the correct item in the tree view", async () => {
      const externalApiUsages = [
        createExternalApiUsage({
          usages: [usage],
        }),
      ];

      const panel = new ModelDetailsPanel(mockCliServer);
      await panel.setState(externalApiUsages, dbItem, hideModeledApis);

      await panel.revealItem(usage);

      expect(mockTreeView.reveal).toHaveBeenCalledWith(usage);
    });

    it("should do nothing if usage cannot be found", async () => {
      const externalApiUsages = [createExternalApiUsage({})];
      const panel = new ModelDetailsPanel(mockCliServer);
      await panel.setState(externalApiUsages, dbItem, hideModeledApis);

      await panel.revealItem(usage);

      expect(mockTreeView.reveal).not.toHaveBeenCalled();
    });
  });
});
