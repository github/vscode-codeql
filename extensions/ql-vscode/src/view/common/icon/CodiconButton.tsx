import * as React from "react";
import { styled } from "styled-components";
import classNames from "classnames";

const StyledButton = styled.button`
  background: none;
  color: var(--vscode-textLink-foreground);
  border: none;
  cursor: pointer;
  padding: 0;
  vertical-align: text-bottom;

  &:disabled {
    color: var(--vscode-disabledForeground);
    cursor: default;
  }
`;

export const CodiconButton = ({
  onClick,
  className,
  name,
  label,
  disabled,
}: {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  name: string;
  label: string;
  disabled?: boolean;
}) => (
  <StyledButton
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
