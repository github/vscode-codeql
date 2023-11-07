export type Snippet = {
  text: string;
  highlight: boolean;
};

export function createHighlights(text: string, search: string): Snippet[] {
  if (search === "") {
    return [{ text, highlight: false }];
  }

  const searchLower = search.toLowerCase();
  const textLower = text.toLowerCase();

  const highlights: Snippet[] = [];

  let index = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
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
