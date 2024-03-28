import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { styled } from "styled-components";
import type {
  ModelAlertsFilterSortState,
  SortKey,
} from "../../model-editor/shared/model-alerts-filter-sort";
import { SearchBox } from "../common/SearchBox";
import { ModelAlertsSort } from "./ModelAlertsSort";

type Props = {
  filterSortValue: ModelAlertsFilterSortState;
  onFilterSortChange: Dispatch<SetStateAction<ModelAlertsFilterSortState>>;
};

const Container = styled.div`
  display: flex;
  gap: 1em;
  width: 100%;
  margin-bottom: 1em;
`;

const ModelsSearchColumn = styled(SearchBox)`
  flex: 2;
`;

const RepositoriesSearchColumn = styled(SearchBox)`
  flex: 2;
`;

const SortColumn = styled(ModelAlertsSort)`
  flex: 1;
`;

export const ModelAlertsSearchSortRow = ({
  filterSortValue,
  onFilterSortChange,
}: Props) => {
  const handleModelSearchValueChange = useCallback(
    (searchValue: string) => {
      onFilterSortChange((oldValue) => ({
        ...oldValue,
        modelSearchValue: searchValue,
      }));
    },
    [onFilterSortChange],
  );

  const handleRepositorySearchValueChange = useCallback(
    (searchValue: string) => {
      onFilterSortChange((oldValue) => ({
        ...oldValue,
        repositorySearchValue: searchValue,
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

  return (
    <Container>
      <ModelsSearchColumn
        placeholder="Filter by model"
        value={filterSortValue.modelSearchValue}
        onChange={handleModelSearchValueChange}
      />
      <RepositoriesSearchColumn
        placeholder="Filter by repository owner/name"
        value={filterSortValue.repositorySearchValue}
        onChange={handleRepositorySearchValueChange}
      />
      <SortColumn
        value={filterSortValue.sortKey}
        onChange={handleSortKeyChange}
      />
    </Container>
  );
};
