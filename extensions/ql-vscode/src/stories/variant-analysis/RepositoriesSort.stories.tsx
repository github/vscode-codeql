import { useState } from "react";

import type { Meta } from "@storybook/react";

import { RepositoriesSort as RepositoriesSortComponent } from "../../view/variant-analysis/RepositoriesSort";
import { SortKey } from "../../variant-analysis/shared/variant-analysis-filter-sort";

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
} as Meta<typeof RepositoriesSortComponent>;

export const RepositoriesSort = () => {
  const [value, setValue] = useState(SortKey.Alphabetically);

  return <RepositoriesSortComponent value={value} onChange={setValue} />;
};
