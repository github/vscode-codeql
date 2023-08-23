import { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import { ExternalApiUsage } from "../../../../../src/data-extensions-editor/external-api-usage";
import { ModelDetailsDataProvider } from "../../../../../src/data-extensions-editor/model-details/model-details-data-provider";
import { DatabaseItem } from "../../../../../src/databases/local-databases";
import {
  createExternalApiUsage,
  createUsage,
} from "../../../../factories/data-extension/external-api-factories";
import { mockedObject } from "../../../utils/mocking.helpers";

describe("ModelDetailsDataProvider", () => {
  const mockCliServer = mockedObject<CodeQLCliServer>({});
  let dataProvider: ModelDetailsDataProvider;

  beforeEach(() => {
    dataProvider = new ModelDetailsDataProvider(mockCliServer);
  });

  describe("setState", () => {
    const hideModeledApis: boolean = false;
    const externalApiUsages: ExternalApiUsage[] = [];
    const dbItem = mockedObject<DatabaseItem>({
      getSourceLocationPrefix: () => "test",
    });

    it("should not emit onDidChangeTreeData event when state has not changed", async () => {
      await dataProvider.setState(externalApiUsages, dbItem, hideModeledApis);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(externalApiUsages, dbItem, hideModeledApis);

      expect(onDidChangeTreeDataListener).not.toHaveBeenCalled();
    });

    it("should emit onDidChangeTreeData event when externalApiUsages has changed", async () => {
      const externalApiUsages2: ExternalApiUsage[] = [];

      await dataProvider.setState(externalApiUsages, dbItem, hideModeledApis);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(externalApiUsages2, dbItem, hideModeledApis);

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when dbItem has changed", async () => {
      const dbItem2 = mockedObject<DatabaseItem>({
        getSourceLocationPrefix: () => "test",
      });

      await dataProvider.setState(externalApiUsages, dbItem, hideModeledApis);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(externalApiUsages, dbItem2, hideModeledApis);

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when hideModeledApis has changed", async () => {
      await dataProvider.setState(externalApiUsages, dbItem, hideModeledApis);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(externalApiUsages, dbItem, !hideModeledApis);

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });

    it("should emit onDidChangeTreeData event when all entries have changed", async () => {
      const dbItem2 = mockedObject<DatabaseItem>({
        getSourceLocationPrefix: () => "test",
      });
      const externalApiUsages2: ExternalApiUsage[] = [];

      await dataProvider.setState(externalApiUsages, dbItem, hideModeledApis);

      const onDidChangeTreeDataListener = jest.fn();
      dataProvider.onDidChangeTreeData(onDidChangeTreeDataListener);

      await dataProvider.setState(
        externalApiUsages2,
        dbItem2,
        !hideModeledApis,
      );

      expect(onDidChangeTreeDataListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("getChildren", () => {
    const supportedExternalApiUsage = createExternalApiUsage({
      supported: true,
    });

    const unsupportedExternalApiUsage = createExternalApiUsage({
      supported: false,
    });

    const externalApiUsages: ExternalApiUsage[] = [
      supportedExternalApiUsage,
      unsupportedExternalApiUsage,
    ];
    const dbItem = mockedObject<DatabaseItem>({
      getSourceLocationPrefix: () => "test",
    });

    const usage = createUsage({});

    it("should return [] if item is a usage", async () => {
      expect(dataProvider.getChildren(usage)).toEqual([]);
    });

    it("should return usages if item is external api usage", async () => {
      const externalApiUsage = createExternalApiUsage({ usages: [usage] });
      expect(dataProvider.getChildren(externalApiUsage)).toEqual([usage]);
    });

    it("should show all externalApiUsages if hideModeledApis is false and item is undefined", async () => {
      const hideModeledApis: boolean = false;
      await dataProvider.setState(externalApiUsages, dbItem, hideModeledApis);
      expect(dataProvider.getChildren().length).toEqual(2);
    });

    it("should filter externalApiUsages if hideModeledApis is true and item is undefined", async () => {
      const hideModeledApis: boolean = true;
      await dataProvider.setState(externalApiUsages, dbItem, hideModeledApis);
      expect(dataProvider.getChildren().length).toEqual(1);
    });
  });
});
