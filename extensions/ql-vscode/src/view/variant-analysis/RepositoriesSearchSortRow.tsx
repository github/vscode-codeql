import * as React from "react";
import { Dispatch, SetStateAction, useCallback } from "react";
import styled from "styled-components";
import {
  FilterKey,
  RepositoriesFilterSortState,
  SortKey,
} from "../../pure/variant-analysis-filter-sort";
import { RepositoriesSearch } from "./RepositoriesSearch";
import { RepositoriesSort } from "./RepositoriesSort";
import { RepositoriesFilter } from "./RepositoriesFilter";

type Props = {
  value: RepositoriesFilterSortState;
  onChange: Dispatch<SetStateAction<RepositoriesFilterSortState>>;
};

const Container = styled.div`
  display: flex;
  gap: 1em;

  width: 100%;
  margin-bottom: 1em;
`;

const RepositoriesSearchColumn = styled(RepositoriesSearch)`
  flex: 3;
`;

const RepositoriesFilterColumn = styled(RepositoriesFilter)`
  flex: 1;
`;

const RepositoriesSortColumn = styled(RepositoriesSort)`
  flex: 1;
`;

export const RepositoriesSearchSortRow = ({ value, onChange }: Props) => {
  const handleSearchValueChange = useCallback(
    (searchValue: string) => {
      onChange((oldValue) => ({
        ...oldValue,
        searchValue,
      }));
    },
    [onChange],
  );

  const handleFilterKeyChange = useCallback(
    (filterKey: FilterKey) => {
      onChange((oldValue) => ({
        ...oldValue,
        filterKey,
      }));
    },
    [onChange],
  );

  const handleSortKeyChange = useCallback(
    (sortKey: SortKey) => {
      onChange((oldValue) => ({
        ...oldValue,
        sortKey,
      }));
    },
    [onChange],
  );

  return (
    <Container>
      <RepositoriesSearchColumn
        value={value.searchValue}
        onChange={handleSearchValueChange}
      />
      <RepositoriesFilterColumn
        value={value.filterKey}
        onChange={handleFilterKeyChange}
      />
      <RepositoriesSortColumn
        value={value.sortKey}
        onChange={handleSortKeyChange}
      />
    </Container>
  );
};
