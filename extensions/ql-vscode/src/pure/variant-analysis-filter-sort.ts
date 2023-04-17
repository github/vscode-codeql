import {
  Repository,
  RepositoryWithMetadata,
} from "../variant-analysis/shared/repository";
import { parseDate } from "./date";

export enum FilterKey {
  All = "all",
  WithResults = "withResults",
}

export enum SortKey {
  Name = "name",
  Stars = "stars",
  LastUpdated = "lastUpdated",
  ResultsCount = "resultsCount",
}

export type RepositoriesFilterSortState = {
  searchValue: string;
  filterKey: FilterKey;
  sortKey: SortKey;
};

export type RepositoriesFilterSortStateWithIds = RepositoriesFilterSortState & {
  repositoryIds?: number[];
};

export const defaultFilterSortState: RepositoriesFilterSortState = {
  searchValue: "",
  filterKey: FilterKey.All,
  sortKey: SortKey.Name,
};

export function matchesFilter(
  repo: Pick<Repository, "fullName">,
  filterSortState: RepositoriesFilterSortState | undefined,
): boolean {
  if (!filterSortState) {
    return true;
  }

  return repo.fullName
    .toLowerCase()
    .includes(filterSortState.searchValue.toLowerCase());
}

type SortableRepository = Pick<Repository, "fullName"> &
  Partial<Pick<RepositoryWithMetadata, "stargazersCount" | "updatedAt">>;

export function compareRepository(
  filterSortState: RepositoriesFilterSortState | undefined,
): (left: SortableRepository, right: SortableRepository) => number {
  return (left: SortableRepository, right: SortableRepository) => {
    // Highest to lowest
    if (filterSortState?.sortKey === SortKey.Stars) {
      const stargazersCount =
        (right.stargazersCount ?? 0) - (left.stargazersCount ?? 0);
      if (stargazersCount !== 0) {
        return stargazersCount;
      }
    }

    // Newest to oldest
    if (filterSortState?.sortKey === SortKey.LastUpdated) {
      const lastUpdated =
        (parseDate(right.updatedAt)?.getTime() ?? 0) -
        (parseDate(left.updatedAt)?.getTime() ?? 0);
      if (lastUpdated !== 0) {
        return lastUpdated;
      }
    }

    // Fall back on name compare
    return left.fullName.localeCompare(right.fullName, undefined, {
      sensitivity: "base",
    });
  };
}

type FilterAndSortableResult = {
  repository: SortableRepository & Pick<Repository, "id">;
  resultCount?: number;
};

export function compareWithResults(
  filterSortState: RepositoriesFilterSortState | undefined,
): (left: FilterAndSortableResult, right: FilterAndSortableResult) => number {
  const fallbackSort = compareRepository(filterSortState);

  return (left: FilterAndSortableResult, right: FilterAndSortableResult) => {
    // Highest to lowest
    if (filterSortState?.sortKey === SortKey.ResultsCount) {
      const resultCount = (right.resultCount ?? 0) - (left.resultCount ?? 0);
      if (resultCount !== 0) {
        return resultCount;
      }
    }

    return fallbackSort(left.repository, right.repository);
  };
}

export function filterAndSortRepositoriesWithResultsByName<
  T extends FilterAndSortableResult,
>(
  repositories: T[] | undefined,
  filterSortState: RepositoriesFilterSortState | undefined,
): T[] | undefined {
  if (!repositories) {
    return undefined;
  }

  return repositories
    .filter((repo) => matchesFilter(repo.repository, filterSortState))
    .sort(compareWithResults(filterSortState));
}

export function filterAndSortRepositoriesWithResults<
  T extends FilterAndSortableResult,
>(
  repositories: T[] | undefined,
  filterSortState: RepositoriesFilterSortStateWithIds | undefined,
): T[] | undefined {
  if (!repositories) {
    return undefined;
  }

  if (
    filterSortState?.repositoryIds &&
    filterSortState.repositoryIds.length > 0
  ) {
    return repositories
      .filter((repo) =>
        filterSortState.repositoryIds?.includes(repo.repository.id),
      )
      .sort(compareWithResults(filterSortState));
  }

  return filterAndSortRepositoriesWithResultsByName(
    repositories,
    filterSortState,
  );
}
