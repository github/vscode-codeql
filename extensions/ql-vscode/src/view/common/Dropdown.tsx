import styled from "styled-components";

/**
 * Styled to look like a `VSCodeDropdown`.
 *
 * The reason for doing this is that `VSCodeDropdown` doesn't handle fitting into
 * available space and truncating content, and this leads to breaking the
 * `VSCodeDataGrid` layout. This version using `select` directly will truncate the
 * content as necessary and fit into whatever space is available.
 * See https://github.com/github/vscode-codeql/pull/2582#issuecomment-1622164429
 * for more info on the problem and other potential solutions.
 */
export const Dropdown = styled.select`
  width: 100%;
  height: calc(var(--input-height) * 1px);
  background: var(--dropdown-background);
  color: var(--foreground);
  font-family: var(--font-family);
  border: none;
  padding: 2px 6px 2px 8px;
`;
