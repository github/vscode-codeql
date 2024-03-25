import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import { styled } from "styled-components";
import type {
  FilterKey,
  RepositoriesFilterSortState,
  SortKey,
} from "../../variant-analysis/shared/variant-analysis-filter-sort";
import { SearchBox } from "../common/SearchBox";
import { RepositoriesSort } from "./RepositoriesSort";
import { RepositoriesFilter } from "./RepositoriesFilter";
import { RepositoriesResultFormat } from "./RepositoriesResultFormat";
import type { ResultFormat } from "../../variant-analysis/shared/variant-analysis-result-format";
import { isSarifResultsQueryKind } from "../../common/query-metadata";

type Props = {
  filterSortValue: RepositoriesFilterSortState;
  resultFormatValue: ResultFormat;
  onFilterSortChange: Dispatch<SetStateAction<RepositoriesFilterSortState>>;
  onResultFormatChange: Dispatch<SetStateAction<ResultFormat>>;
  variantAnalysisQueryKind: string | undefined;
};

const Container = styled.div`
  display: flex;
  gap: 1em;

  width: 100%;
  margin-bottom: 1em;
`;

const RepositoriesSearchColumn = styled(SearchBox)`
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

function showResultFormatColumn(
  variantAnalysisQueryKind: string | undefined,
): boolean {
  return isSarifResultsQueryKind(variantAnalysisQueryKind);
}

export const RepositoriesSearchSortRow = ({
  filterSortValue,
  resultFormatValue,
  onFilterSortChange,
  onResultFormatChange,
  variantAnalysisQueryKind,
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
        placeholder="Filter by repository owner/name"
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
      {showResultFormatColumn(variantAnalysisQueryKind) && (
        <RepositoriesResultFormatColumn
          value={resultFormatValue}
          onChange={handleResultFormatChange}
        />
      )}
    </Container>
  );
};
