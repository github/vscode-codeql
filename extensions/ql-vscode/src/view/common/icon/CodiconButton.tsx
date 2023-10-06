import * as React from "react";
import { styled } from "styled-components";
import classNames from "classnames";

type Size = "x-small" | "small" | "medium" | "large" | "x-large";

const StyledButton = styled.button<{ size: Size }>`
  background: none;
  color: var(--vscode-textLink-foreground);
  border: none;
  cursor: pointer;
  font-size: ${(props) => props.size ?? "1em"};
  padding: 0;
  vertical-align: text-bottom;

  &:disabled {
    color: var(--vscode-disabledForeground);
    cursor: default;
  }
`;

export const CodiconButton = ({
  size,
  onClick,
  className,
  name,
  label,
  disabled,
}: {
  size?: Size;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  name: string;
  label: string;
  disabled?: boolean;
}) => (
  <StyledButton
    size={size}
    onClick={onClick}
    className={className}
    disabled={disabled}
    aria-label={label}
    title={label}
  >
    <span
      role="img"
      className={classNames("codicon", `codicon-${name}`, className)}
    />
  </StyledButton>
);
