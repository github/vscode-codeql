import { useState } from "react";

import type { Meta } from "@storybook/react";

import { RepositoriesSearchSortRow as RepositoriesSearchSortRowComponent } from "../../view/variant-analysis/RepositoriesSearchSortRow";
import { defaultFilterSortState } from "../../variant-analysis/shared/variant-analysis-filter-sort";
import { ResultFormat } from "../../variant-analysis/shared/variant-analysis-result-format";

export default {
  title: "Variant Analysis/Repositories Search and Sort Row",
  component: RepositoriesSearchSortRowComponent,
  argTypes: {
    value: {
      control: {
        disable: true,
      },
    },
  },
} as Meta<typeof RepositoriesSearchSortRowComponent>;

export const RepositoriesSearchSortRow = () => {
  const [filterSortValue, setFilterSortValue] = useState(
    defaultFilterSortState,
  );

  const [resultFormatValue, setResultFormatValue] = useState(
    ResultFormat.Alerts,
  );

  const variantAnalysisQueryKind = "problem";

  return (
    <RepositoriesSearchSortRowComponent
      filterSortValue={filterSortValue}
      resultFormatValue={resultFormatValue}
      onFilterSortChange={setFilterSortValue}
      onResultFormatChange={setResultFormatValue}
      variantAnalysisQueryKind={variantAnalysisQueryKind}
    />
  );
};
