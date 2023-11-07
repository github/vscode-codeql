import type { Option } from "./suggestions";
import { HighlightedText } from "./HighlightedText";
import { createHighlights } from "./highlight";
import { useMemo } from "react";
import { parseAccessPathParts } from "./access-path";

type Props = {
  item: Option;
  inputValue: string;
};

export const LabelText = ({ item, inputValue }: Props) => {
  const highlights = useMemo(() => {
    const parts = parseAccessPathParts(inputValue);
    const highlightedInputValue = parts[parts.length - 1] ?? "";

    return createHighlights(item.label, highlightedInputValue);
  }, [item, inputValue]);

  return <HighlightedText snippets={highlights} />;
};
