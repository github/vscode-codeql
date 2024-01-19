import type { Repository, RepositoryWithMetadata } from "./repository";
import { assertNever } from "../../common/helpers-pure";

export enum FilterKey {
  All = "all",
  WithResults = "withResults",
}

export enum SortKey {
  Alphabetically = "alphabetically",
  Popularity = "popularity",
  NumberOfResults = "numberOfResults",
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
  sortKey: SortKey.NumberOfResults,
};

export function matchesFilter(
  item: FilterAndSortableResult,
  filterSortState: RepositoriesFilterSortState | undefined,
): boolean {
  if (!filterSortState) {
    return true;
  }

  return (
    matchesSearch(item.repository, filterSortState.searchValue) &&
    matchesFilterKey(item.resultCount, filterSortState.filterKey)
  );
}

function matchesSearch(
  repository: SortableRepository,
  searchValue: string,
): boolean {
  return repository.fullName.toLowerCase().includes(searchValue.toLowerCase());
}

function matchesFilterKey(
  resultCount: number | undefined,
  filterKey: FilterKey,
): boolean {
  switch (filterKey) {
    case FilterKey.All:
      return true;
    case FilterKey.WithResults:
      return resultCount !== undefined && resultCount > 0;
    default:
      assertNever(filterKey);
  }
}

type SortableRepository = Pick<Repository, "fullName"> &
  Partial<Pick<RepositoryWithMetadata, "stargazersCount" | "updatedAt">>;

export function compareRepository(
  filterSortState: RepositoriesFilterSortState | undefined,
): (left: SortableRepository, right: SortableRepository) => number {
  return (left: SortableRepository, right: SortableRepository) => {
    // Highest to lowest
    if (filterSortState?.sortKey === SortKey.Popularity) {
      const stargazersCount =
        (right.stargazersCount ?? 0) - (left.stargazersCount ?? 0);
      if (stargazersCount !== 0) {
        return stargazersCount;
      }
    }

    // Fall back on name compare. Use en-US because the repository name does not contain
    // special characters due to restrictions in GitHub owner/repository names.
    return left.fullName.localeCompare(right.fullName, "en-US", {
      sensitivity: "base",
    });
  };
}

type FilterAndSortableResult = {
  repository: SortableRepository;
  resultCount?: number;
};

type FilterAndSortableResultWithIds = {
  repository: SortableRepository & Pick<Repository, "id">;
  resultCount?: number;
};

export function compareWithResults(
  filterSortState: RepositoriesFilterSortState | undefined,
): (left: FilterAndSortableResult, right: FilterAndSortableResult) => number {
  const fallbackSort = compareRepository(filterSortState);

  return (left: FilterAndSortableResult, right: FilterAndSortableResult) => {
    // Highest to lowest
    if (filterSortState?.sortKey === SortKey.NumberOfResults) {
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
    .filter((repo) => matchesFilter(repo, filterSortState))
    .sort(compareWithResults(filterSortState));
}

export function filterAndSortRepositoriesWithResults<
  T extends FilterAndSortableResultWithIds,
>(
  repositories: T[] | undefined,
  filterSortState: RepositoriesFilterSortStateWithIds | undefined,
): T[] | undefined {
  if (!repositories) {
    return undefined;
  }

  // If repository IDs are given, then ignore the search value and filter key
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
