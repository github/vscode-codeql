import {
  compareRepository,
  compareWithResults,
  defaultFilterSortState,
  filterAndSortRepositoriesWithResults,
  filterAndSortRepositoriesWithResultsByName,
  FilterKey,
  matchesFilter,
  SortKey,
} from "../../src/pure/variant-analysis-filter-sort";

describe(matchesFilter.name, () => {
  const repository = {
    fullName: "github/codeql",
  };

  describe("searchValue", () => {
    const testCases = [
      { searchValue: "", matches: true },
      { searchValue: "github/codeql", matches: true },
      { searchValue: "github", matches: true },
      { searchValue: "git", matches: true },
      { searchValue: "codeql", matches: true },
      { searchValue: "code", matches: true },
      { searchValue: "ql", matches: true },
      { searchValue: "/", matches: true },
      { searchValue: "gothub/codeql", matches: false },
      { searchValue: "hello", matches: false },
      { searchValue: "cod*ql", matches: false },
      { searchValue: "cod?ql", matches: false },
    ];

    test.each(testCases)(
      "returns $matches if searching for $searchValue",
      ({ searchValue, matches }) => {
        expect(
          matchesFilter(
            { repository },
            {
              ...defaultFilterSortState,
              searchValue,
            },
          ),
        ).toBe(matches);
      },
    );
  });

  describe("filterKey", () => {
    it("returns true if filterKey is all and resultCount is positive", () => {
      expect(
        matchesFilter(
          { repository, resultCount: 1 },
          { ...defaultFilterSortState, filterKey: FilterKey.All },
        ),
      ).toBe(true);
    });

    it("returns true if filterKey is all and resultCount is zero", () => {
      expect(
        matchesFilter(
          { repository, resultCount: 0 },
          { ...defaultFilterSortState, filterKey: FilterKey.All },
        ),
      ).toBe(true);
    });

    it("returns true if filterKey is all and resultCount is undefined", () => {
      expect(
        matchesFilter(
          { repository },
          { ...defaultFilterSortState, filterKey: FilterKey.All },
        ),
      ).toBe(true);
    });

    it("returns true if filterKey is withResults and resultCount is positive", () => {
      expect(
        matchesFilter(
          { repository, resultCount: 1 },
          { ...defaultFilterSortState, filterKey: FilterKey.WithResults },
        ),
      ).toBe(true);
    });

    it("returns false if filterKey is withResults and resultCount is zero", () => {
      expect(
        matchesFilter(
          { repository, resultCount: 0 },
          { ...defaultFilterSortState, filterKey: FilterKey.WithResults },
        ),
      ).toBe(false);
    });

    it("returns false if filterKey is withResults and resultCount is undefined", () => {
      expect(
        matchesFilter(
          { repository },
          { ...defaultFilterSortState, filterKey: FilterKey.WithResults },
        ),
      ).toBe(false);
    });
  });
});

describe(compareRepository.name, () => {
  describe("when sort key is undefined", () => {
    const sorter = compareRepository(undefined);

    const left = {
      fullName: "github/galaxy",
    };
    const right = {
      fullName: "github/world",
    };

    it("compares correctly", () => {
      expect(sorter(left, right)).toBeLessThan(0);
    });

    it("compares the inverse correctly", () => {
      expect(sorter(right, left)).toBeGreaterThan(0);
    });

    it("compares equal values correctly", () => {
      expect(sorter(left, left)).toBe(0);
    });
  });

  describe("when sort key is 'Alphabetically'", () => {
    const sorter = compareRepository({
      ...defaultFilterSortState,
      sortKey: SortKey.Alphabetically,
    });

    const left = {
      fullName: "github/galaxy",
    };
    const right = {
      fullName: "github/world",
    };

    it("compares correctly", () => {
      expect(sorter(left, right)).toBeLessThan(0);
    });

    it("compares the inverse correctly", () => {
      expect(sorter(right, left)).toBeGreaterThan(0);
    });

    it("compares equal values correctly", () => {
      expect(sorter(left, left)).toBe(0);
    });
  });

  describe("when sort key is 'Popularity'", () => {
    const sorter = compareRepository({
      ...defaultFilterSortState,
      sortKey: SortKey.Popularity,
    });

    const left = {
      fullName: "github/galaxy",
      stargazersCount: 1,
    };
    const right = {
      fullName: "github/world",
      stargazersCount: 10,
    };

    it("compares correctly", () => {
      expect(sorter(left, right)).toBeGreaterThan(0);
    });

    it("compares the inverse correctly", () => {
      expect(sorter(right, left)).toBeLessThan(0);
    });

    it("compares equal values correctly", () => {
      expect(sorter(left, left)).toBe(0);
    });

    it("compares equal single values correctly", () => {
      expect(
        sorter(left, {
          ...right,
          stargazersCount: left.stargazersCount,
        }),
      ).toBeLessThan(0);
    });

    it("compares missing single values correctly", () => {
      expect(
        sorter(left, {
          ...right,
          stargazersCount: undefined,
        }),
      ).toBeLessThan(0);
    });
  });

  describe("when sort key is 'Most recent commit'", () => {
    const sorter = compareRepository({
      ...defaultFilterSortState,
      sortKey: SortKey.MostRecentCommit,
    });

    const left = {
      fullName: "github/galaxy",
      updatedAt: "2020-01-01T00:00:00Z",
    };
    const right = {
      fullName: "github/world",
      updatedAt: "2021-01-01T00:00:00Z",
    };

    it("compares correctly", () => {
      expect(sorter(left, right)).toBeGreaterThan(0);
    });

    it("compares the inverse correctly", () => {
      expect(sorter(right, left)).toBeLessThan(0);
    });

    it("compares equal values correctly", () => {
      expect(sorter(left, left)).toBe(0);
    });

    it("compares equal single values correctly", () => {
      expect(
        sorter(left, {
          ...right,
          updatedAt: left.updatedAt,
        }),
      ).toBeLessThan(0);
    });

    it("compares missing single values correctly", () => {
      expect(
        sorter(
          {
            ...left,
            updatedAt: undefined,
          },
          right,
        ),
      ).toBeGreaterThan(0);
    });
  });
});

describe(compareWithResults.name, () => {
  describe("when sort key is undefined", () => {
    const sorter = compareWithResults(undefined);

    const left = {
      repository: {
        id: 10,
        fullName: "github/galaxy",
      },
    };
    const right = {
      repository: {
        id: 12,
        fullName: "github/world",
      },
    };

    it("compares correctly", () => {
      expect(sorter(left, right)).toBeLessThan(0);
    });
  });

  describe("when sort key is 'Popularity'", () => {
    const sorter = compareWithResults({
      ...defaultFilterSortState,
      sortKey: SortKey.Popularity,
    });

    const left = {
      repository: {
        id: 11,
        fullName: "github/galaxy",
        stargazersCount: 1,
      },
    };
    const right = {
      repository: {
        id: 12,
        fullName: "github/world",
        stargazersCount: 10,
      },
    };

    it("compares correctly", () => {
      expect(sorter(left, right)).toBeGreaterThan(0);
    });
  });

  describe("when sort key is 'Most recent commit'", () => {
    const sorter = compareWithResults({
      ...defaultFilterSortState,
      sortKey: SortKey.MostRecentCommit,
    });

    const left = {
      repository: {
        id: 11,
        fullName: "github/galaxy",
        updatedAt: "2020-01-01T00:00:00Z",
      },
    };
    const right = {
      repository: {
        id: 12,
        fullName: "github/world",
        updatedAt: "2021-01-01T00:00:00Z",
      },
    };

    it("compares correctly", () => {
      expect(sorter(left, right)).toBeGreaterThan(0);
    });
  });

  describe("when sort key is results count", () => {
    const sorter = compareWithResults({
      ...defaultFilterSortState,
      sortKey: SortKey.NumberOfResults,
    });

    const left = {
      repository: {
        id: 11,
        fullName: "github/galaxy",
      },
      resultCount: 10,
    };
    const right = {
      repository: {
        id: 12,
        fullName: "github/world",
      },
      resultCount: 100,
    };

    it("compares correctly", () => {
      expect(sorter(left, right)).toBeGreaterThan(0);
    });

    it("compares the inverse correctly", () => {
      expect(sorter(right, left)).toBeLessThan(0);
    });

    it("compares equal values correctly", () => {
      expect(sorter(left, left)).toBe(0);
    });

    it("compares equal single values correctly", () => {
      expect(
        sorter(left, {
          ...right,
          resultCount: left.resultCount,
        }),
      ).toBeLessThan(0);
    });

    it("compares missing single values correctly", () => {
      expect(
        sorter(
          {
            ...left,
            resultCount: undefined,
          },
          right,
        ),
      ).toBeGreaterThan(0);
    });
  });
});

describe(filterAndSortRepositoriesWithResultsByName.name, () => {
  const repositories = [
    {
      repository: {
        id: 10,
        fullName: "github/galaxy",
      },
      resultCount: 10,
    },
    {
      repository: {
        id: 11,
        fullName: "github/world",
      },
      resultCount: undefined,
    },
    {
      repository: {
        id: 13,
        fullName: "github/planet",
      },
      resultCount: 500,
    },
    {
      repository: {
        id: 783532,
        fullName: "github/stars",
      },
      resultCount: 8000,
    },
  ];

  describe("when sort key is given without search or filter", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResultsByName(repositories, {
          ...defaultFilterSortState,
          sortKey: SortKey.NumberOfResults,
        }),
      ).toEqual([
        repositories[3],
        repositories[2],
        repositories[0],
        repositories[1],
      ]);
    });
  });

  describe("when sort key and search are given without filter", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResultsByName(repositories, {
          ...defaultFilterSortState,
          sortKey: SortKey.NumberOfResults,
          searchValue: "la",
        }),
      ).toEqual([repositories[2], repositories[0]]);
    });
  });

  describe("when sort key and filter withResults are given without search", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResultsByName(repositories, {
          ...defaultFilterSortState,
          sortKey: SortKey.NumberOfResults,
          filterKey: FilterKey.WithResults,
        }),
      ).toEqual([repositories[3], repositories[2], repositories[0]]);
    });
  });

  describe("when sort key, search, and filter withResults are given", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResultsByName(repositories, {
          sortKey: SortKey.NumberOfResults,
          filterKey: FilterKey.WithResults,
          searchValue: "r",
        }),
      ).toEqual([repositories[3]]);
    });
  });
});

describe(filterAndSortRepositoriesWithResults.name, () => {
  const repositories = [
    {
      repository: {
        id: 10,
        fullName: "github/galaxy",
      },
      resultCount: 10,
    },
    {
      repository: {
        id: 11,
        fullName: "github/world",
      },
      resultCount: undefined,
    },
    {
      repository: {
        id: 13,
        fullName: "github/planet",
      },
      resultCount: 500,
    },
    {
      repository: {
        id: 783532,
        fullName: "github/stars",
      },
      resultCount: 8000,
    },
  ];

  describe("when sort key is given", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResults(repositories, {
          ...defaultFilterSortState,
          sortKey: SortKey.NumberOfResults,
        }),
      ).toEqual([
        repositories[3],
        repositories[2],
        repositories[0],
        repositories[1],
      ]);
    });
  });

  describe("when sort key and search are given", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResults(repositories, {
          ...defaultFilterSortState,
          sortKey: SortKey.NumberOfResults,
          searchValue: "la",
        }),
      ).toEqual([repositories[2], repositories[0]]);
    });
  });

  describe("when sort key and filter withResults are given", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResults(repositories, {
          ...defaultFilterSortState,
          sortKey: SortKey.NumberOfResults,
          filterKey: FilterKey.WithResults,
        }),
      ).toEqual([repositories[3], repositories[2], repositories[0]]);
    });
  });

  describe("when sort key and filter withResults are given", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResults(repositories, {
          ...defaultFilterSortState,
          sortKey: SortKey.NumberOfResults,
          filterKey: FilterKey.WithResults,
        }),
      ).toEqual([repositories[3], repositories[2], repositories[0]]);
    });
  });

  describe("when sort key, search, and filter withResults are given", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResults(repositories, {
          ...defaultFilterSortState,
          sortKey: SortKey.NumberOfResults,
          filterKey: FilterKey.WithResults,
          searchValue: "r",
        }),
      ).toEqual([repositories[3]]);
    });
  });

  describe("when sort key, search, filter withResults, and repository ids are given", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResults(repositories, {
          sortKey: SortKey.NumberOfResults,
          filterKey: FilterKey.WithResults,
          searchValue: "la",
          repositoryIds: [
            repositories[1].repository.id,
            repositories[3].repository.id,
          ],
        }),
      ).toEqual([repositories[3], repositories[1]]);
    });
  });

  describe("when repository ids are given", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResults(repositories, {
          ...defaultFilterSortState,
          repositoryIds: [
            repositories[0].repository.id,
            repositories[3].repository.id,
          ],
        }),
      ).toEqual([repositories[0], repositories[3]]);
    });
  });

  describe("when empty repository ids are given", () => {
    it("returns the correct results", () => {
      expect(
        filterAndSortRepositoriesWithResults(repositories, {
          ...defaultFilterSortState,
          repositoryIds: [],
        }),
      ).toEqual([
        repositories[0],
        repositories[2],
        repositories[3],
        repositories[1],
      ]);
    });
  });
});
