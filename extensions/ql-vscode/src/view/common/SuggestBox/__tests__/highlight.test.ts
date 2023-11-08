import { createHighlights } from "../highlight";

describe("createHighlights", () => {
  it.each([
    {
      text: "Argument[foo].Element.Field[@test]",
      search: "Argument[foo]",
      snippets: [
        { text: "Argument[foo]", highlight: true },
        {
          text: ".Element.Field[@test]",
          highlight: false,
        },
      ],
    },
    {
      text: "Field[@test]",
      search: "test",
      snippets: [
        { text: "Field[@", highlight: false },
        {
          text: "test",
          highlight: true,
        },
        {
          text: "]",
          highlight: false,
        },
      ],
    },
    {
      text: "Field[@test]",
      search: "TEST",
      snippets: [
        { text: "Field[@", highlight: false },
        {
          text: "test",
          highlight: true,
        },
        {
          text: "]",
          highlight: false,
        },
      ],
    },
    {
      text: "Field[@test]",
      search: "[@TEST",
      snippets: [
        { text: "Field", highlight: false },
        {
          text: "[@test",
          highlight: true,
        },
        {
          text: "]",
          highlight: false,
        },
      ],
    },
    {
      text: "Field[@test]",
      search: "",
      snippets: [{ text: "Field[@test]", highlight: false }],
    },
  ])(
    `creates highlights for $text with $search`,
    ({ text, search, snippets }) => {
      expect(createHighlights(text, search)).toEqual(snippets);
    },
  );
});
