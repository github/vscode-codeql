import { useMemo } from "react";
import { createHighlights } from "./highlight";
import { HighlightedText } from "./HighlightedText";
import type { Option } from "./options";

type Props<T extends Option<T>> = {
  item: T;

  tokens: string[];
};

export const LabelText = <T extends Option<T>>({ item, tokens }: Props<T>) => {
  const highlights = useMemo(() => {
    const highlightedToken = tokens[tokens.length - 1] ?? "";

    return createHighlights(item.label, highlightedToken);
  }, [item, tokens]);

  return <HighlightedText snippets={highlights} />;
};
