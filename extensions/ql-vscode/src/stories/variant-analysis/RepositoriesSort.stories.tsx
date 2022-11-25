import React, { useState } from "react";

import { ComponentMeta } from "@storybook/react";

import { RepositoriesSort as RepositoriesSortComponent } from "../../view/variant-analysis/RepositoriesSort";
import { SortKey } from "../../pure/variant-analysis-filter-sort";

export default {
  title: "Variant Analysis/Repositories Sort",
  component: RepositoriesSortComponent,
  argTypes: {
    value: {
      control: {
        disable: true,
      },
    },
  },
} as ComponentMeta<typeof RepositoriesSortComponent>;

export const RepositoriesSort = () => {
  const [value, setValue] = useState(SortKey.Name);

  return <RepositoriesSortComponent value={value} onChange={setValue} />;
};
