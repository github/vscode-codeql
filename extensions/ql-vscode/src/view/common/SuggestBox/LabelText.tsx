import type { AccessPathOption } from "../../../model-editor/suggestions";
import { HighlightedText } from "./HighlightedText";
import { createHighlights } from "./highlight";
import { useMemo } from "react";
import { parseAccessPathTokens } from "./access-path";

type Props = {
  item: AccessPathOption;
  inputValue: string;
};

export const LabelText = ({ item, inputValue }: Props) => {
  const highlights = useMemo(() => {
    const tokens = parseAccessPathTokens(inputValue);
    const highlightedInputValue = tokens[tokens.length - 1]?.text ?? "";

    return createHighlights(item.label, highlightedInputValue);
  }, [item, inputValue]);

  return <HighlightedText snippets={highlights} />;
};
