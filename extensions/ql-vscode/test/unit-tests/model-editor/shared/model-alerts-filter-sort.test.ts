import type { ModelAlerts } from "../../../../src/model-editor/model-alerts/model-alerts";
import type { ModelAlertsFilterSortState } from "../../../../src/model-editor/shared/model-alerts-filter-sort";
import {
  SortKey,
  filterAndSort,
} from "../../../../src/model-editor/shared/model-alerts-filter-sort";
import { createSinkModeledMethod } from "../../../factories/model-editor/modeled-method-factories";
import { createMockAnalysisAlert } from "../../../factories/variant-analysis/shared/analysis-alert";
import { shuffle } from "../../../vscode-tests/utils/list-helpers";

describe("model alerts filter sort", () => {
  const modelAlerts: ModelAlerts[] = [
    {
      model: createSinkModeledMethod({
        signature: "foo.m1",
      }),
      alerts: [
        {
          alert: createMockAnalysisAlert(),
          repository: {
            id: 1,
            fullName: "r1",
          },
        },
        {
          alert: createMockAnalysisAlert(),
          repository: {
            id: 2,
            fullName: "r2",
          },
        },
        {
          alert: createMockAnalysisAlert(),
          repository: {
            id: 3,
            fullName: "r3",
          },
        },
        {
          alert: createMockAnalysisAlert(),
          repository: {
            id: 4,
            fullName: "r4",
          },
        },
      ],
    },
    {
      model: createSinkModeledMethod({
        signature: "foo.m2",
      }),
      alerts: [
        {
          alert: createMockAnalysisAlert(),
          repository: {
            id: 1,
            fullName: "r1",
          },
        },
        {
          alert: createMockAnalysisAlert(),
          repository: {
            id: 2,
            fullName: "r2",
          },
        },
      ],
    },
    {
      model: createSinkModeledMethod({
        signature: "bar.m1",
      }),
      alerts: [
        {
          alert: createMockAnalysisAlert(),
          repository: {
            id: 1,
            fullName: "r1",
          },
        },
      ],
    },
  ];

  it("should return an empty array if no model alerts", () => {
    const filterSortState: ModelAlertsFilterSortState = {
      modelSearchValue: "",
      repositorySearchValue: "",
      sortKey: SortKey.Alphabetically,
    };

    const result = filterAndSort([], filterSortState);

    expect(result).toEqual([]);
  });

  it("should filter model alerts based on the model search value", () => {
    const filterSortState: ModelAlertsFilterSortState = {
      modelSearchValue: "m1",
      repositorySearchValue: "",
      sortKey: SortKey.Alphabetically,
    };

    const result = filterAndSort(modelAlerts, filterSortState);

    expect(result.includes(modelAlerts[0])).toBeTruthy();
    expect(result.includes(modelAlerts[2])).toBeTruthy();
  });

  it("should filter model alerts based on the repository search value", () => {
    const filterSortState: ModelAlertsFilterSortState = {
      modelSearchValue: "",
      repositorySearchValue: "r2",
      sortKey: SortKey.Alphabetically,
    };

    const result = filterAndSort(modelAlerts, filterSortState);

    expect(result.includes(modelAlerts[0])).toBeTruthy();
    expect(result.includes(modelAlerts[1])).toBeTruthy();
  });

  it("should sort model alerts alphabetically", () => {
    const filterSortState: ModelAlertsFilterSortState = {
      modelSearchValue: "",
      repositorySearchValue: "",
      sortKey: SortKey.Alphabetically,
    };

    const result = filterAndSort(shuffle([...modelAlerts]), filterSortState);

    expect(result).toEqual([modelAlerts[2], modelAlerts[0], modelAlerts[1]]);
  });

  it("should sort model alerts by number of results", () => {
    const filterSortState: ModelAlertsFilterSortState = {
      modelSearchValue: "",
      repositorySearchValue: "",
      sortKey: SortKey.NumberOfResults,
    };

    const result = filterAndSort(shuffle([...modelAlerts]), filterSortState);

    expect(result).toEqual([modelAlerts[0], modelAlerts[1], modelAlerts[2]]);
  });

  it("should filter and sort model alerts", () => {
    const filterSortState: ModelAlertsFilterSortState = {
      modelSearchValue: "m1",
      repositorySearchValue: "r1",
      sortKey: SortKey.NumberOfResults,
    };

    const result = filterAndSort(shuffle([...modelAlerts]), filterSortState);

    expect(result).toEqual([modelAlerts[0], modelAlerts[2]]);
  });
});
