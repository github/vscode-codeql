import * as React from "react";
import { useState } from "react";

import { ComponentMeta } from "@storybook/react";

import { RepositoriesFilter as RepositoriesFilterComponent } from "../../view/variant-analysis/RepositoriesFilter";
import { FilterKey } from "../../variant-analysis/variant-analysis-filter-sort";

export default {
  title: "Variant Analysis/Repositories Filter",
  component: RepositoriesFilterComponent,
  argTypes: {
    value: {
      control: {
        disable: true,
      },
    },
  },
} as ComponentMeta<typeof RepositoriesFilterComponent>;

export const RepositoriesFilter = () => {
  const [value, setValue] = useState(FilterKey.All);

  return <RepositoriesFilterComponent value={value} onChange={setValue} />;
};
