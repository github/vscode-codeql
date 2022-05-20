import * as React from 'react';
import { FilterIcon } from '@primer/octicons-react';
import { ActionList, ActionMenu, IconButton } from '@primer/react';
import styled from 'styled-components';

const SortWrapper = styled.span`
  flex-grow: 2;
  text-align: right;
  margin-right: 0;
`;

export type Sort = 'name' | 'stars' | 'results';
type Props = {
  sort: Sort;
  setSort: (sort: Sort) => void;
};

type Sortable = {
  nwo: string;
  starCount?: number;
  resultCount?: number;
};

const sortBy = [
  { name: 'Sort by Name', sort: 'name' },
  { name: 'Sort by Results', sort: 'results' },
  { name: 'Sort by Stars', sort: 'stars' },
];

export function sorter(sort: Sort): (left: Sortable, right: Sortable) => number {
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

// FIXME These styles are not correct. Need to figure out
// why the theme is not being applied to the ActionMenu
const SortRepoFilter = ({ sort, setSort }: Props) => {
  return <SortWrapper>
    <ActionMenu>
      <ActionMenu.Anchor>
        <IconButton icon={FilterIcon} variant="invisible" aria-label="Sort results" />
      </ActionMenu.Anchor>

      <ActionMenu.Overlay width="small" anchorSide="outside-bottom">
        <ActionList selectionVariant="single">
          {sortBy.map((type, index) => (
            <ActionList.Item
              key={index}
              selected={type.sort === sort} onSelect={() => setSort(type.sort as Sort)}
            >
              {type.name}
            </ActionList.Item>
          ))}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  </SortWrapper>;

};

export default SortRepoFilter;
