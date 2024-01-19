import { findMatchingOptions } from "../options";

type TestOption = {
  label: string;
  value: string;
  followup?: TestOption[];
};

const suggestedOptions: TestOption[] = [
  {
    label: "Argument[self]",
    value: "Argument[self]",
  },
  {
    label: "Argument[0]",
    value: "Argument[0]",
    followup: [
      {
        label: "Element[0]",
        value: "Argument[0].Element[0]",
      },
      {
        label: "Element[1]",
        value: "Argument[0].Element[1]",
      },
    ],
  },
  {
    label: "Argument[1]",
    value: "Argument[1]",
  },
  {
    label: "Argument[text_rep:]",
    value: "Argument[text_rep:]",
  },
  {
    label: "Argument[block]",
    value: "Argument[block]",
    followup: [
      {
        label: "Parameter[0]",
        value: "Argument[block].Parameter[0]",
        followup: [
          {
            label: "Element[:query]",
            value: "Argument[block].Parameter[0].Element[:query]",
          },
          {
            label: "Element[:parameters]",
            value: "Argument[block].Parameter[0].Element[:parameters]",
          },
        ],
      },
      {
        label: "Parameter[1]",
        value: "Argument[block].Parameter[1]",
        followup: [
          {
            label: "Field[@query]",
            value: "Argument[block].Parameter[1].Field[@query]",
          },
        ],
      },
    ],
  },
  {
    label: "ReturnValue",
    value: "ReturnValue",
  },
];

describe("findMatchingOptions", () => {
  it.each([
    {
      // Argument[block].
      tokens: ["Argument[block]", ""],
      options: ["Argument[block].Parameter[0]", "Argument[block].Parameter[1]"],
    },
    {
      // Argument[block].Parameter[0]
      tokens: ["Argument[block]", "Parameter[0]"],
      options: ["Argument[block].Parameter[0]"],
    },
    {
      // Argument[block].Parameter[0].
      tokens: ["Argument[block]", "Parameter[0]", ""],
      options: [
        "Argument[block].Parameter[0].Element[:query]",
        "Argument[block].Parameter[0].Element[:parameters]",
      ],
    },
    {
      // ""
      tokens: [""],
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
      // ""
      tokens: [],
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
      // block
      tokens: ["block"],
      options: ["Argument[block]"],
    },
    {
      // l
      tokens: ["l"],
      options: ["Argument[self]", "Argument[block]", "ReturnValue"],
    },
    {
      // L
      tokens: ["L"],
      options: ["Argument[self]", "Argument[block]", "ReturnValue"],
    },
  ])(`creates options for $value`, ({ tokens, options }) => {
    expect(
      findMatchingOptions(suggestedOptions, tokens).map(
        (option) => option.value,
      ),
    ).toEqual(options);
  });
});
