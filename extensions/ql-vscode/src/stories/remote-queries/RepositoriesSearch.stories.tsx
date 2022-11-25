import React, { useState } from "react";

import { ComponentMeta } from "@storybook/react";

import RepositoriesSearchComponent from "../../view/remote-queries/RepositoriesSearch";

export default {
  title: "MRVA/Repositories Search",
  component: RepositoriesSearchComponent,
  argTypes: {
    filterValue: {
      control: {
        disable: true,
      },
    },
  },
} as ComponentMeta<typeof RepositoriesSearchComponent>;

export const RepositoriesSearch = () => {
  const [filterValue, setFilterValue] = useState("");

  return (
    <RepositoriesSearchComponent
      filterValue={filterValue}
      setFilterValue={setFilterValue}
    />
  );
};
