import { findMatchingOptions } from "../suggestions";
import type { AccessPathOption } from "../../../../model-editor/suggestions";

const suggestedOptions: AccessPathOption[] = [
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
      },
      {
        label: "Element[1]",
        icon: "symbol-field",
        value: "Argument[0].Element[1]",
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

describe("findMatchingOptions", () => {
  it.each([
    {
      value: "Argument[block].",
      options: ["Argument[block].Parameter[0]", "Argument[block].Parameter[1]"],
    },
    {
      value: "Argument[block].Parameter[0]",
      options: ["Argument[block].Parameter[0]"],
    },
    {
      value: "Argument[block].Parameter[0].",
      options: [
        "Argument[block].Parameter[0].Element[:query]",
        "Argument[block].Parameter[0].Element[:parameters]",
      ],
    },
    {
      value: "",
      options: [
        "Argument[self]",
        "Argument[0]",
        "Argument[1]",
        "Argument[text_rep:]",
        "Argument[block]",
        "ReturnValue",
      ],
    },
    {
      value: "block",
      options: ["Argument[block]"],
    },
    {
      value: "l",
      options: ["Argument[self]", "Argument[block]", "ReturnValue"],
    },
    {
      value: "L",
      options: ["Argument[self]", "Argument[block]", "ReturnValue"],
    },
  ])(`creates options for $value`, ({ value, options }) => {
    expect(
      findMatchingOptions(suggestedOptions, value).map(
        (option) => option.value,
      ),
    ).toEqual(options);
  });
});
