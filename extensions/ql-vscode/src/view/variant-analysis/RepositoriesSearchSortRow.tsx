import * as React from "react";
import { Dispatch, SetStateAction, useCallback } from "react";
import styled from "styled-components";
import {
  RepositoriesFilterSortState,
  SortKey,
} from "../../pure/variant-analysis-filter-sort";
import { RepositoriesSearch } from "./RepositoriesSearch";
import { RepositoriesSort } from "./RepositoriesSort";

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
      <RepositoriesSortColumn
        value={value.sortKey}
        onChange={handleSortKeyChange}
      />
    </Container>
  );
};
