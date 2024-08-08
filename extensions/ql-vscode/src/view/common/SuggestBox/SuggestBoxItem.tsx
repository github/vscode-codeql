import type { HTMLProps, ReactNode } from "react";
import { forwardRef } from "react";
import { useId } from "@floating-ui/react";
import { styled } from "styled-components";

const Container = styled.div<{ $active: boolean }>`
  display: flex;
  box-sizing: border-box;
  padding-right: 10px;
  background-repeat: no-repeat;
  background-position: 2px 2px;
  white-space: nowrap;
  cursor: pointer;
  touch-action: none;
  padding-left: 2px;

  font-family: var(--vscode-editor-font-family);

  color: ${(props) =>
    props.$active
      ? "var(--vscode-editorSuggestWidget-selectedForeground)"
      : "var(--vscode-editorSuggestWidget-foreground)"};
  background-color: ${(props) =>
    props.$active
      ? "var(--vscode-editorSuggestWidget-selectedBackground)"
      : "transparent"};
`;

const LabelContainer = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
  white-space: pre;
  justify-content: space-between;
  align-items: center;
`;

const Label = styled.span`
  flex-shrink: 1;
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DetailsLabel = styled.span`
  overflow: hidden;
  flex-shrink: 4;
  max-width: 70%;

  font-size: 85%;
  margin-left: 1.1em;
  opacity: 0.7;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

type Props = {
  active: boolean;
  icon?: ReactNode;
  labelText: ReactNode;
  details?: ReactNode;
};

export const SuggestBoxItem = forwardRef<
  HTMLDivElement,
  Props & HTMLProps<HTMLDivElement>
>(
  (
    {
      children,
      active,
      icon,
      labelText,
      details,
      ...props
    }: Props & HTMLProps<HTMLDivElement>,
    ref,
  ) => {
    const id = useId();
    return (
      <Container
        ref={ref}
        role="option"
        id={id}
        aria-selected={active}
        $active={active}
        {...props}
      >
        {icon}
        <LabelContainer>
          <Label>{labelText}</Label>
          {details && <DetailsLabel>{details}</DetailsLabel>}
        </LabelContainer>
      </Container>
    );
  },
);
SuggestBoxItem.displayName = "SuggestBoxItem";
