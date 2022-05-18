import * as React from 'react';
import { FilterIcon } from '@primer/octicons-react';
import { ActionList, ActionMenu } from '@primer/react';

export type Sort = 'name' | 'stars' | 'results';
type SortBy = { name: string, sort: Sort }[];
type Props = {
  sort: Sort;
  setSort: (sort: Sort) => void;
};

type Sortable = {
  nwo: string;
  starCount?: number;
  resultCount?: number;
};

const sortBy: SortBy = [
  { name: 'Sort by Name', sort: 'name' },
  { name: 'Sort by Results', sort: 'results' },
  { name: 'Sort by Stars', sort: 'stars' },
];

export function sorter(sort: Sort) {
  // stars and results are highest to lowest
  // name is alphabetical
  return (left: Sortable, right: Sortable) => {
    if (sort === 'stars') {
      const stars = (right.starCount || 0) - (left.starCount || 0);
      if (stars !== 0) {
        return stars;
      }
    }
    if (sort === 'results') {
      const results = (right.resultCount || 0) - (left.resultCount || 0);
      if (results !== 0) {
        return results;
      }
    }

    // Fall back on name compare if results or stars are equal
    return left.nwo.localeCompare(right.nwo, undefined, { sensitivity: 'base' });
  };
}

const SortRepoFilter = ({ sort, setSort }: Props) => {
  return <span className="vscode-codeql__analysis-sorter">
    <ActionMenu>
      <ActionMenu.Button
        className="vscode-codeql__analysis-sort-dropdown"
        aria-label="Sort results"
        leadingIcon={FilterIcon}
        trailingIcon="" />
      <ActionMenu.Overlay width="medium">
        <ActionList selectionVariant="single">
          {sortBy.map((type, index) => (
            <ActionList.Item key={index} selected={type.sort === sort} onSelect={() => setSort(type.sort)}>
              {type.name}
            </ActionList.Item>
          ))}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  </span>;

};

export default SortRepoFilter;
