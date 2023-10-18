import * as React from "react";
import { forwardRef } from "react";
import { styled } from "styled-components";

/*
 * A drop-in replacement for the VSCodeDataGrid family of components.
 *
 * The difference is that the `display: grid` styling is applied to `DataGrid`, whereas
 * in the VS Code version that styling is applied to `VSCodeDataGridRow`. This gives
 * column alignment across rows in situation with dynamic contents. It also allows
 * for cells to span multiple rows and all the other features of data grids.
 */

const StyledDataGrid = styled.div<{ $gridTemplateColumns: string | number }>`
  display: grid;
  grid-template-columns: ${(props) => props.$gridTemplateColumns};
  box-sizing: border-box;
  width: 100%;
  background: transparent;
`;

interface DataGridProps {
  gridTemplateColumns: string;
  children: React.ReactNode;
}

export function DataGrid({ gridTemplateColumns, children }: DataGridProps) {
  return (
    <StyledDataGrid $gridTemplateColumns={gridTemplateColumns}>
      {children}
    </StyledDataGrid>
  );
}

const StyledDataGridRow = styled.div<{ $focused?: boolean }>`
  display: contents;

  &:hover > * {
    background-color: var(--list-hover-background);
  }

  & > * {
    // Use !important to override the background color set by the hover state
    background-color: ${(props) =>
      props.$focused
        ? "var(--vscode-editor-selectionBackground) !important"
        : "inherit"};
  }
`;

interface DataGridRowProps {
  focused?: boolean;
  children: React.ReactNode;
  "data-testid"?: string;
}

export const DataGridRow = forwardRef(
  (
    { focused, children, "data-testid": testId }: DataGridRowProps,
    ref?: React.Ref<HTMLElement | undefined>,
  ) => (
    <StyledDataGridRow $focused={focused} ref={ref} data-testid={testId}>
      {children}
    </StyledDataGridRow>
  ),
);
DataGridRow.displayName = "DataGridRow";

const StyledDataGridCell = styled.div<{
  $gridRow?: string | number;
  $gridColumn?: string | number;
}>`
  ${({ $gridRow }) => ($gridRow ? `grid-row: ${$gridRow};` : "")}
  ${({ $gridColumn }) => ($gridColumn ? `grid-column: ${$gridColumn};` : "")}
  padding: 4px 12px;

  &.header {
    font-weight: 600;
  }
`;

interface DataGridCellProps {
  rowType?: "default" | "header";
  gridRow?: string | number;
  gridColumn?: string | number;
  className?: string;
  children: React.ReactNode;
}

export function DataGridCell({
  rowType = "default",
  gridRow,
  gridColumn,
  className,
  children,
}: DataGridCellProps) {
  className = `${className || ""} ${rowType}`;
  return (
    <StyledDataGridCell
      $gridRow={gridRow}
      $gridColumn={gridColumn}
      className={className}
    >
      {children}
    </StyledDataGridCell>
  );
}
