import * as React from "react";
import { useState } from "react";

import { ComponentMeta } from "@storybook/react";

import { RepositoriesSearchSortRow as RepositoriesSearchSortRowComponent } from "../../view/variant-analysis/RepositoriesSearchSortRow";
import { defaultFilterSortState } from "../../variant-analysis/shared/variant-analysis-filter-sort";

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
} as ComponentMeta<typeof RepositoriesSearchSortRowComponent>;

export const RepositoriesSearchSortRow = () => {
  const [value, setValue] = useState(defaultFilterSortState);

  return (
    <RepositoriesSearchSortRowComponent value={value} onChange={setValue} />
  );
};
