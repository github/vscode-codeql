import { window, TreeView } from "vscode";
import { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import {
  CallClassification,
  ExternalApiUsage,
} from "../../../../../src/data-extensions-editor/external-api-usage";
import { ModelDetailsPanel } from "../../../../../src/data-extensions-editor/model-details/model-details-panel";
import { DatabaseItem } from "../../../../../src/databases/local-databases";
import { mockedObject } from "../../../utils/mocking.helpers";

describe("ModelDetailsPanel", () => {
  const mockCliServer = mockedObject<CodeQLCliServer>({});

  describe("setState", () => {
    const hideModeledApis: boolean = false;
    const externalApiUsages: ExternalApiUsage[] = [
      {
        library: "test",
        supported: false,
        supportedType: "none",
        usages: [],
        signature: "test",
        packageName: "test",
        typeName: "test",
        methodName: "test",
        methodParameters: "test",
      },
    ];
    const dbItem = mockedObject<DatabaseItem>({
      getSourceLocationPrefix: () => "test",
    });

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
    const dbItem = mockedObject<DatabaseItem>({
      getSourceLocationPrefix: () => "test",
    });
    const usage = {
      classification: "unknown" as CallClassification,
      label: "test",
      url: {
        uri: "test",
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 1,
      },
    };

    beforeEach(() => {
      mockTreeView = {
        reveal: jest.fn(),
      } as unknown as TreeView<unknown>;
      jest.spyOn(window, "createTreeView").mockReturnValue(mockTreeView);
    });

    it("should reveal the correct item in the tree view", async () => {
      const externalApiUsages = mockedObject<ExternalApiUsage[]>([
        {
          usages: [usage],
        },
      ]);

      const panel = new ModelDetailsPanel(mockCliServer);
      await panel.setState(externalApiUsages, dbItem, hideModeledApis);

      await panel.revealItem(usage);

      expect(mockTreeView.reveal).toHaveBeenCalledWith(usage);
    });

    it("should do nothing if usage cannot be found", async () => {
      const externalApiUsages = mockedObject<ExternalApiUsage[]>([]);

      const panel = new ModelDetailsPanel(mockCliServer);
      await panel.setState(externalApiUsages, dbItem, hideModeledApis);

      await panel.revealItem(usage);

      expect(mockTreeView.reveal).not.toHaveBeenCalled();
    });
  });
});
