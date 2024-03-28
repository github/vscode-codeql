import { useState } from "react";

import type { Meta } from "@storybook/react";

import { SearchBox as SearchBoxComponent } from "../../view/common/SearchBox";

export default {
  title: "Search Box",
  component: SearchBoxComponent,
  argTypes: {
    value: {
      control: {
        disable: true,
      },
    },
  },
} as Meta<typeof SearchBoxComponent>;

export const SearchBox = () => {
  const [value, setValue] = useState("");

  return (
    <SearchBoxComponent
      value={value}
      placeholder="Filter by x/y/z..."
      onChange={setValue}
    />
  );
};
