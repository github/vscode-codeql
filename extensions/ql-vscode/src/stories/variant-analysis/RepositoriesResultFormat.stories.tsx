import { useState } from "react";

import type { Meta } from "@storybook/react";

import { RepositoriesResultFormat as RepositoriesResultFormatComponent } from "../../view/variant-analysis/RepositoriesResultFormat";
import { ResultFormat } from "../../variant-analysis/shared/variant-analysis-result-format";

export default {
  title: "Variant Analysis/Repositories Result Format",
  component: RepositoriesResultFormatComponent,
  argTypes: {
    value: {
      control: {
        disable: true,
      },
    },
  },
} as Meta<typeof RepositoriesResultFormatComponent>;

export const RepositoriesResultFormat = () => {
  const [value, setValue] = useState(ResultFormat.Alerts);

  return (
    <RepositoriesResultFormatComponent value={value} onChange={setValue} />
  );
};
