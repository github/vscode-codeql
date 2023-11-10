import type { Option } from "../suggestions";
import { parseQueryResults, findMatchingOptions } from "../suggestions";
import type { DecodedBqrsChunk } from "../../../../common/bqrs-cli-types";

const suggestedOptions: Option[] = [
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

const queryResult: DecodedBqrsChunk = {
  columns: [
    { name: "type", kind: "String" },
    { name: "path", kind: "String" },
    { name: "value", kind: "String" },
    { name: "details", kind: "String" },
    { name: "defType", kind: "String" },
  ],
  tuples: [
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[0]",
      "name",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[self]",
      "self in create_function",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[block].Parameter[0]",
      "fp",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[block]",
      "call to call",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[1]",
      "arity",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[block].Parameter[1]",
      "* ...",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[2]",
      "text_rep",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_aggregate_handler]",
      "Argument[0]",
      "handler",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_aggregate_handler]",
      "Argument[self]",
      "self in create_aggregate_handler",
      "parameter",
    ],
    [
      "SQLite3::Database::FunctionProxy!",
      "Method[new]",
      "Argument[self]",
      "self in initialize",
      "parameter",
    ],
  ],
};

describe("parseQueryResults", () => {
  expect(parseQueryResults(queryResult)).toEqual({
    "SQLite3::Database": {
      "Method[create_function]": [
        {
          label: "Argument[self]",
          value: "Argument[self]",
          details: "self in create_function",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[0]",
          value: "Argument[0]",
          details: "name",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[1]",
          value: "Argument[1]",
          details: "arity",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[2]",
          value: "Argument[2]",
          details: "text_rep",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[block]",
          value: "Argument[block]",
          details: "call to call",
          icon: "symbol-parameter",
          followup: [
            {
              label: "Parameter[0]",
              value: "Argument[block].Parameter[0]",
              details: "fp",
              icon: "symbol-parameter",
              followup: [],
            },
            {
              label: "Parameter[1]",
              value: "Argument[block].Parameter[1]",
              details: "* ...",
              icon: "symbol-parameter",
              followup: [],
            },
          ],
        },
      ],
      "Method[create_aggregate_handler]": [
        {
          label: "Argument[self]",
          value: "Argument[self]",
          details: "self in create_aggregate_handler",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[0]",
          value: "Argument[0]",
          details: "handler",
          icon: "symbol-parameter",
          followup: [],
        },
      ],
    },
    "SQLite3::Database::FunctionProxy!": {
      "Method[new]": [
        {
          label: "Argument[self]",
          value: "Argument[self]",
          details: "self in initialize",
          icon: "symbol-parameter",
          followup: [],
        },
      ],
    },
  });
});
