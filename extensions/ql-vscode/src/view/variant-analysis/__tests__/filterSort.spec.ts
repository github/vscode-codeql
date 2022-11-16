import { compareRepository, compareWithResults, defaultFilterSortState, matchesFilter, SortKey } from '../../../pure/variant-analysis-filter-sort';

// TODO: Move this file to the "pure" tests once it has been switched to Jest
describe(matchesFilter.name, () => {
  const repository = {
    fullName: 'github/codeql'
  };

  const testCases = [
    { searchValue: '', matches: true },
    { searchValue: 'github/codeql', matches: true },
    { searchValue: 'github', matches: true },
    { searchValue: 'git', matches: true },
    { searchValue: 'codeql', matches: true },
    { searchValue: 'code', matches: true },
    { searchValue: 'ql', matches: true },
    { searchValue: '/', matches: true },
    { searchValue: 'gothub/codeql', matches: false },
    { searchValue: 'hello', matches: false },
    { searchValue: 'cod*ql', matches: false },
    { searchValue: 'cod?ql', matches: false },
  ];

  test.each(testCases)('returns $matches if searching for $searchValue', ({ searchValue, matches }) => {
    expect(matchesFilter(repository, {
      ...defaultFilterSortState,
      searchValue,
    })).toBe(matches);
  });
});

describe(compareRepository.name, () => {
  describe('when sort key is undefined', () => {
    const sorter = compareRepository(undefined);

    const left = {
      fullName: 'github/galaxy'
    };
    const right = {
      fullName: 'github/world'
    };

    it('compares correctly', () => {
      expect(sorter(left, right)).toBeLessThan(0);
    });

    it('compares the inverse correctly', () => {
      expect(sorter(right, left)).toBeGreaterThan(0);
    });

    it('compares equal values correctly', () => {
      expect(sorter(left, left)).toBe(0);
    });
  });

  describe('when sort key is name', () => {
    const sorter = compareRepository({
      ...defaultFilterSortState,
      sortKey: SortKey.Name,
    });

    const left = {
      fullName: 'github/galaxy'
    };
    const right = {
      fullName: 'github/world'
    };

    it('compares correctly', () => {
      expect(sorter(left, right)).toBeLessThan(0);
    });

    it('compares the inverse correctly', () => {
      expect(sorter(right, left)).toBeGreaterThan(0);
    });

    it('compares equal values correctly', () => {
      expect(sorter(left, left)).toBe(0);
    });
  });

  describe('when sort key is stars', () => {
    const sorter = compareRepository({
      ...defaultFilterSortState,
      sortKey: SortKey.Stars,
    });

    const left = {
      fullName: 'github/galaxy',
      stargazersCount: 1,
    };
    const right = {
      fullName: 'github/world',
      stargazersCount: 10,
    };

    it('compares correctly', () => {
      expect(sorter(left, right)).toBeGreaterThan(0);
    });

    it('compares the inverse correctly', () => {
      expect(sorter(right, left)).toBeLessThan(0);
    });

    it('compares equal values correctly', () => {
      expect(sorter(left, left)).toBe(0);
    });

    it('compares equal single values correctly', () => {
      expect(sorter(left, {
        ...right,
        stargazersCount: left.stargazersCount,
      })).toBeLessThan(0);
    });

    it('compares missing single values correctly', () => {
      expect(sorter(left, {
        ...right,
        stargazersCount: undefined,
      })).toBeLessThan(0);
    });
  });

  describe('when sort key is last updated', () => {
    const sorter = compareRepository({
      ...defaultFilterSortState,
      sortKey: SortKey.LastUpdated,
    });

    const left = {
      fullName: 'github/galaxy',
      updatedAt: '2020-01-01T00:00:00Z',
    };
    const right = {
      fullName: 'github/world',
      updatedAt: '2021-01-01T00:00:00Z',
    };

    it('compares correctly', () => {
      expect(sorter(left, right)).toBeGreaterThan(0);
    });

    it('compares the inverse correctly', () => {
      expect(sorter(right, left)).toBeLessThan(0);
    });

    it('compares equal values correctly', () => {
      expect(sorter(left, left)).toBe(0);
    });

    it('compares equal single values correctly', () => {
      expect(sorter(left, {
        ...right,
        updatedAt: left.updatedAt,
      })).toBeLessThan(0);
    });

    it('compares missing single values correctly', () => {
      expect(sorter({
        ...left,
        updatedAt: undefined,
      }, right)).toBeGreaterThan(0);
    });
  });
});

describe(compareWithResults.name, () => {
  describe('when sort key is undefined', () => {
    const sorter = compareWithResults(undefined);

    const left = {
      repository: {
        fullName: 'github/galaxy',
      },
    };
    const right = {
      repository: {
        fullName: 'github/world',
      },
    };

    it('compares correctly', () => {
      expect(sorter(left, right)).toBeLessThan(0);
    });
  });

  describe('when sort key is stars', () => {
    const sorter = compareWithResults({
      ...defaultFilterSortState,
      sortKey: SortKey.Stars,
    });

    const left = {
      repository: {
        fullName: 'github/galaxy',
        stargazersCount: 1,
      },
    };
    const right = {
      repository: {
        fullName: 'github/world',
        stargazersCount: 10,
      },
    };

    it('compares correctly', () => {
      expect(sorter(left, right)).toBeGreaterThan(0);
    });
  });

  describe('when sort key is last updated', () => {
    const sorter = compareWithResults({
      ...defaultFilterSortState,
      sortKey: SortKey.LastUpdated,
    });

    const left = {
      repository: {
        fullName: 'github/galaxy',
        updatedAt: '2020-01-01T00:00:00Z',
      },
    };
    const right = {
      repository: {
        fullName: 'github/world',
        updatedAt: '2021-01-01T00:00:00Z',
      },
    };

    it('compares correctly', () => {
      expect(sorter(left, right)).toBeGreaterThan(0);
    });
  });

  describe('when sort key is results count', () => {
    const sorter = compareWithResults({
      ...defaultFilterSortState,
      sortKey: SortKey.ResultsCount,
    });

    const left = {
      repository: {
        fullName: 'github/galaxy',
      },
      resultCount: 10,
    };
    const right = {
      repository: {
        fullName: 'github/world',
      },
      resultCount: 100,
    };

    it('compares correctly', () => {
      expect(sorter(left, right)).toBeGreaterThan(0);
    });

    it('compares the inverse correctly', () => {
      expect(sorter(right, left)).toBeLessThan(0);
    });

    it('compares equal values correctly', () => {
      expect(sorter(left, left)).toBe(0);
    });

    it('compares equal single values correctly', () => {
      expect(sorter(left, {
        ...right,
        resultCount: left.resultCount,
      })).toBeLessThan(0);
    });

    it('compares missing single values correctly', () => {
      expect(sorter({
        ...left,
        resultCount: undefined,
      }, right)).toBeGreaterThan(0);
    });
  });
});
