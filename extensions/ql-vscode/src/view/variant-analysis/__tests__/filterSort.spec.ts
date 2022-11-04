import { matchesSearchValue } from '../filterSort';

describe(matchesSearchValue.name, () => {
  const repository = {
    fullName: 'github/codeql'
  };

  const testCases = [
    { searchValue: undefined, matches: true },
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
    expect(matchesSearchValue(repository, searchValue)).toBe(matches);
  });
});
