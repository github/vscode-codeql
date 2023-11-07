import type { Option } from "./suggestions";
import { HighlightedText } from "./HighlightedText";
import { createHighlights } from "./highlight";
import { useMemo } from "react";

type Props = {
  item: Option;
  inputValue: string;
};

export const LabelText = ({ item, inputValue }: Props) => {
  const highlights = useMemo(() => {
    const parts = inputValue.split(".");
    const highlightedInputValue = parts[parts.length - 1];

    return createHighlights(item.label, highlightedInputValue);
  }, [item, inputValue]);

  return <HighlightedText snippets={highlights} />;
};
