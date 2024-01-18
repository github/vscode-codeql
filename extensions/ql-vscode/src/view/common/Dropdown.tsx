import type { ChangeEvent } from "react";
import { styled } from "styled-components";

const DISABLED_VALUE = "-";

const StyledDropdown = styled.select`
  width: 100%;
  height: calc(var(--input-height) * 1px);
  background: var(--vscode-dropdown-background);
  color: var(--vscode-foreground);
  border-width: 0 5px 0 0;
  padding: 2px 6px 2px 8px;
  opacity: ${(props) =>
    props.disabled ? "var(--disabled-opacity)" : "inherit"};
`;

type Props = {
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  className?: string;
  disabledPlaceholder?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;

  "aria-label"?: string;
};

const stopClickPropagation = (e: React.MouseEvent) => {
  e.stopPropagation();
};
/**
 * A dropdown implementation styled to look like `VSCodeDropdown`.
 *
 * The reason for doing this is that `VSCodeDropdown` doesn't handle fitting into
 * available space and truncating content, and this leads to breaking the
 * `VSCodeDataGrid` layout. This version using `select` directly will truncate the
 * content as necessary and fit into whatever space is available.
 * See https://github.com/github/vscode-codeql/pull/2582#issuecomment-1622164429
 * for more info on the problem and other potential solutions.
 */
export function Dropdown({
  value,
  options,
  disabled,
  disabledPlaceholder,
  className,
  onChange,
  ...props
}: Props) {
  const disabledValue = disabledPlaceholder ?? DISABLED_VALUE;
  return (
    <StyledDropdown
      value={disabled ? disabledValue : value}
      disabled={disabled}
      onChange={onChange}
      onClick={stopClickPropagation}
      className={className}
      {...props}
    >
      {disabled ? (
        <option key={disabledValue} value={disabledValue}>
          {disabledValue}
        </option>
      ) : (
        options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))
      )}
    </StyledDropdown>
  );
}
