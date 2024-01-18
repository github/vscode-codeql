export type Snippet = {
  text: string;
  highlight: boolean;
};

/**
 * Highlight creates a list of snippets that can be used to render a highlighted
 * string. This highlight is case-insensitive.
 *
 * @param text The text in which to create highlights
 * @param search The string that will be highlighted in the text.
 * @returns A list of snippets that can be used to render a highlighted string.
 */
export function createHighlights(text: string, search: string): Snippet[] {
  if (search === "") {
    return [{ text, highlight: false }];
  }

  const searchLower = search.toLowerCase();
  const textLower = text.toLowerCase();

  const highlights: Snippet[] = [];

  let index = 0;
  for (;;) {
    const searchIndex = textLower.indexOf(searchLower, index);
    if (searchIndex === -1) {
      break;
    }

    highlights.push({
      text: text.substring(index, searchIndex),
      highlight: false,
    });
    highlights.push({
      text: text.substring(searchIndex, searchIndex + search.length),
      highlight: true,
    });

    index = searchIndex + search.length;
  }

  highlights.push({
    text: text.substring(index),
    highlight: false,
  });

  return highlights.filter((highlight) => highlight.text !== "");
}
