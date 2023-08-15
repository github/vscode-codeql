import { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import { ExternalApiUsage } from "../../../../../src/data-extensions-editor/external-api-usage";
import { ModelDetailsDataProvider } from "../../../../../src/data-extensions-editor/model-details/model-details-data-provider";
import { DatabaseItem } from "../../../../../src/databases/local-databases";
import { mockedObject } from "../../../utils/mocking.helpers";

describe("ModelDetailsDataProvider", () => {
  const mockCliServer = mockedObject<CodeQLCliServer>({});

  describe("setState", () => {
    it("should not emit onDidChangeTreeData event when state has not changed", async () => {
      const externalApiUsages: ExternalApiUsage[] = [];
      const dbItem = mockedObject<DatabaseItem>({
        getSourceLocationPrefix: () => "test",
      });

      const dataProvider = new ModelDetailsDataProvider(mockCliServer);
      await dataProvider.setState(externalApiUsages, dbItem);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(externalApiUsages, dbItem);

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(0);
    });

    it("should emit onDidChangeTreeData event when externalApiUsages has changed", async () => {
      const externalApiUsages1: ExternalApiUsage[] = [];
      const externalApiUsages2: ExternalApiUsage[] = [];
      const dbItem = mockedObject<DatabaseItem>({
        getSourceLocationPrefix: () => "test",
      });

      const dataProvider = new ModelDetailsDataProvider(mockCliServer);
      await dataProvider.setState(externalApiUsages1, dbItem);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(externalApiUsages2, dbItem);

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when dbItem has changed", async () => {
      const externalApiUsages: ExternalApiUsage[] = [];
      const dbItem1 = mockedObject<DatabaseItem>({
        getSourceLocationPrefix: () => "test",
      });
      const dbItem2 = mockedObject<DatabaseItem>({
        getSourceLocationPrefix: () => "test",
      });

      const dataProvider = new ModelDetailsDataProvider(mockCliServer);
      await dataProvider.setState(externalApiUsages, dbItem1);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(externalApiUsages, dbItem2);

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });
  });
});
