import * as React from "react";
import { Dispatch, SetStateAction, useCallback } from "react";
import { styled } from "styled-components";
import {
  FilterKey,
  RepositoriesFilterSortState,
  SortKey,
} from "../../variant-analysis/shared/variant-analysis-filter-sort";
import { RepositoriesSearch } from "./RepositoriesSearch";
import { RepositoriesSort } from "./RepositoriesSort";
import { RepositoriesFilter } from "./RepositoriesFilter";
import { RepositoriesResultFormat } from "./RepositoriesResultFormat";
import { ResultFormat } from "../../variant-analysis/shared/variant-analysis-result-format";

type Props = {
  filterSortValue: RepositoriesFilterSortState;
  resultFormatValue: ResultFormat;
  onFilterSortChange: Dispatch<SetStateAction<RepositoriesFilterSortState>>;
  onResultFormatChange: Dispatch<SetStateAction<ResultFormat>>;
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

const RepositoriesResultFormatColumn = styled(RepositoriesResultFormat)`
  flex: 1;
`;

export const RepositoriesSearchSortRow = ({
  filterSortValue,
  resultFormatValue,
  onFilterSortChange,
  onResultFormatChange,
}: Props) => {
  const handleSearchValueChange = useCallback(
    (searchValue: string) => {
      onFilterSortChange((oldValue) => ({
        ...oldValue,
        searchValue,
      }));
    },
    [onFilterSortChange],
  );

  const handleFilterKeyChange = useCallback(
    (filterKey: FilterKey) => {
      onFilterSortChange((oldValue) => ({
        ...oldValue,
        filterKey,
      }));
    },
    [onFilterSortChange],
  );

  const handleSortKeyChange = useCallback(
    (sortKey: SortKey) => {
      onFilterSortChange((oldValue) => ({
        ...oldValue,
        sortKey,
      }));
    },
    [onFilterSortChange],
  );

  const handleResultFormatChange = useCallback(
    (resultFormat: ResultFormat) => {
      onResultFormatChange(resultFormat);
    },
    [onResultFormatChange],
  );

  return (
    <Container>
      <RepositoriesSearchColumn
        value={filterSortValue.searchValue}
        onChange={handleSearchValueChange}
      />
      <RepositoriesFilterColumn
        value={filterSortValue.filterKey}
        onChange={handleFilterKeyChange}
      />
      <RepositoriesSortColumn
        value={filterSortValue.sortKey}
        onChange={handleSortKeyChange}
      />
      <RepositoriesResultFormatColumn
        value={resultFormatValue}
        onChange={handleResultFormatChange}
      />
    </Container>
  );
};
