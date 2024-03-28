import type { ModelAlerts } from "../model-alerts/model-alerts";

export enum SortKey {
  Alphabetically = "alphabetically",
  NumberOfResults = "numberOfResults",
}

export type ModelAlertsFilterSortState = {
  modelSearchValue: string;
  repositorySearchValue: string;
  sortKey: SortKey;
};

export const defaultFilterSortState: ModelAlertsFilterSortState = {
  modelSearchValue: "",
  repositorySearchValue: "",
  sortKey: SortKey.NumberOfResults,
};

export function filterAndSort(
  modelAlerts: ModelAlerts[],
  filterSortState: ModelAlertsFilterSortState,
): ModelAlerts[] {
  if (!modelAlerts || modelAlerts.length === 0) {
    return [];
  }

  return modelAlerts
    .filter((item) => matchesFilter(item, filterSortState))
    .sort((a, b) => {
      switch (filterSortState.sortKey) {
        case SortKey.Alphabetically:
          return a.model.signature.localeCompare(b.model.signature);
        case SortKey.NumberOfResults:
          return (b.alerts.length || 0) - (a.alerts.length || 0);
        default:
          return 0;
      }
    });
}

function matchesFilter(
  item: ModelAlerts,
  filterSortState: ModelAlertsFilterSortState | undefined,
): boolean {
  if (!filterSortState) {
    return true;
  }

  return (
    matchesRepository(item, filterSortState.repositorySearchValue) &&
    matchesModel(item, filterSortState.modelSearchValue)
  );
}

function matchesRepository(
  item: ModelAlerts,
  repositorySearchValue: string,
): boolean {
  // We may want to only return alerts that have a repository match
  // but for now just return true if the model has any alerts
  // with a matching repo.

  return item.alerts.some((alert) =>
    alert.repository.fullName
      .toLowerCase()
      .includes(repositorySearchValue.toLowerCase()),
  );
}

function matchesModel(item: ModelAlerts, modelSearchValue: string): boolean {
  return item.model.signature
    .toLowerCase()
    .includes(modelSearchValue.toLowerCase());
}
