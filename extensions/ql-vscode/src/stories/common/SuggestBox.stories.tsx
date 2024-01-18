import type { Meta, StoryFn } from "@storybook/react";

import { styled } from "styled-components";

import { Codicon } from "../../view/common";
import { SuggestBox as SuggestBoxComponent } from "../../view/common/SuggestBox/SuggestBox";
import { useCallback, useState } from "react";
import type { Diagnostic } from "../../view/common/SuggestBox/diagnostics";

export default {
  title: "Suggest Box",
  component: SuggestBoxComponent,
} as Meta<typeof SuggestBoxComponent>;

type StoryOption = {
  label: string;
  icon: string;
  details?: string;
  value: string;
  followup?: StoryOption[];
};

const Template: StoryFn<typeof SuggestBoxComponent<StoryOption>> = (args) => {
  const [value, setValue] = useState("");

  const handleChange = useCallback(
    (value: string) => {
      args.onChange(value);
      setValue(value);
    },
    [args],
  );

  return (
    <SuggestBoxComponent<StoryOption>
      {...args}
      value={value}
      onChange={handleChange}
    />
  );
};

const Icon = styled(Codicon)`
  margin-right: 4px;
  color: var(--vscode-symbolIcon-fieldForeground);
  font-size: 16px;
`;

const suggestedOptions: StoryOption[] = [
  {
    label: "Argument[self]",
    icon: "symbol-class",
    details: "sqlite3.SQLite3::Database",
    value: "Argument[self]",
  },
  {
    label: "Argument[0]",
    icon: "symbol-parameter",
    details: "name",
    value: "Argument[0]",
    followup: [
      {
        label: "Element[0]",
        icon: "symbol-field",
        value: "Argument[0].Element[0]",
        details: "first character",
      },
      {
        label: "Element[1]",
        icon: "symbol-field",
        value: "Argument[0].Element[1]",
        details: "second character",
      },
      {
        label: "Element[any]",
        icon: "symbol-field",
        value: "Argument[0].Element[any]",
        details: "any character",
      },
    ],
  },
  {
    label: "Argument[1]",
    icon: "symbol-parameter",
    details: "arity",
    value: "Argument[1]",
  },
  {
    label: "Argument[text_rep:]",
    icon: "symbol-parameter",
    details: "text_rep:",
    value: "Argument[text_rep:]",
  },
  {
    label: "Argument[block]",
    icon: "symbol-parameter",
    details: "&block",
    value: "Argument[block]",
    followup: [
      {
        label: "Parameter[0]",
        icon: "symbol-parameter",
        value: "Argument[block].Parameter[0]",
        details: "val",
        followup: [
          {
            label: "Element[:query]",
            icon: "symbol-key",
            value: "Argument[block].Parameter[0].Element[:query]",
          },
          {
            label: "Element[:parameters]",
            icon: "symbol-key",
            value: "Argument[block].Parameter[0].Element[:parameters]",
          },
        ],
      },
      {
        label: "Parameter[1]",
        icon: "symbol-parameter",
        value: "Argument[block].Parameter[1]",
        details: "context",
        followup: [
          {
            label: "Field[@query]",
            icon: "symbol-field",
            value: "Argument[block].Parameter[1].Field[@query]",
          },
        ],
      },
    ],
  },
  {
    label: "ReturnValue",
    icon: "symbol-variable",
    details: undefined,
    value: "ReturnValue",
  },
];

export const AccessPath = Template.bind({});
AccessPath.args = {
  options: suggestedOptions,
  parseValueToTokens: (value: string) => value.split("."),
  validateValue: (value: string) => {
    let index = value.indexOf("|");

    const diagnostics: Diagnostic[] = [];

    while (index !== -1) {
      // For testing in this Storybook, disallow pipe characters to avoid a dependency on the
      // real access path validation.
      index = value.indexOf("|", index + 1);

      diagnostics.push({
        message: "This cannot contain |",
        range: {
          start: index,
          end: index + 1,
        },
      });
    }

    return diagnostics;
  },
  getIcon: (option: StoryOption) => <Icon name={option.icon} />,
  getDetails: (option: StoryOption) => option.details,
};
