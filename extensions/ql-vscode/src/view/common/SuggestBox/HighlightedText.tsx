import { styled } from "styled-components";
import type { Snippet } from "./highlight";

const Normal = styled.span``;
const Highlighted = styled.span`
  font-weight: 700;
  color: var(--vscode-editorSuggestWidget-focusHighlightForeground);
`;

type Props = {
  snippets: Snippet[];
};

export const HighlightedText = ({ snippets }: Props) => {
  return (
    <>
      {snippets.map((snippet, index) =>
        snippet.highlight ? (
          <Highlighted key={index}>{snippet.text}</Highlighted>
        ) : (
          <Normal key={index}>{snippet.text}</Normal>
        ),
      )}
    </>
  );
};
