import * as React from "react";
import { useState } from "react";

import { ComponentMeta } from "@storybook/react";

import { RepositoriesSearch as RepositoriesSearchComponent } from "../../view/variant-analysis/RepositoriesSearch";

export default {
  title: "Variant Analysis/Repositories Search",
  component: RepositoriesSearchComponent,
  argTypes: {
    value: {
      control: {
        disable: true,
      },
    },
  },
} as ComponentMeta<typeof RepositoriesSearchComponent>;

export const RepositoriesSearch = () => {
  const [value, setValue] = useState("");

  return <RepositoriesSearchComponent value={value} onChange={setValue} />;
};
