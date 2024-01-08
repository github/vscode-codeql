import { useState } from "react";

import type { Meta } from "@storybook/react";

import { RepositoriesFilter as RepositoriesFilterComponent } from "../../view/variant-analysis/RepositoriesFilter";
import { FilterKey } from "../../variant-analysis/shared/variant-analysis-filter-sort";

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
} as Meta<typeof RepositoriesFilterComponent>;

export const RepositoriesFilter = () => {
  const [value, setValue] = useState(FilterKey.All);

  return <RepositoriesFilterComponent value={value} onChange={setValue} />;
};
