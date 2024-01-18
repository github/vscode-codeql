import type { ReactNode } from "react";
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
  children: ReactNode;
}

/**
 * The top level for a grid systemm that will contain `DataGridRow` and `DataGridCell` components.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns for how to use `gridTemplateColumns`.
 */
export function DataGrid({ gridTemplateColumns, children }: DataGridProps) {
  return (
    <StyledDataGrid $gridTemplateColumns={gridTemplateColumns}>
      {children}
    </StyledDataGrid>
  );
}

const StyledDataGridRow = styled.div<{
  $focused?: boolean;
  $selected?: boolean;
}>`
  display: contents;

  &:hover > * {
    background-color: var(--list-hover-background);
  }

  & > * {
    // Use !important to override the background color set by the hover state
    background-color: ${(props) =>
      props.$focused
        ? "var(--vscode-editor-findMatchHighlightBackground) !important"
        : props.$selected
          ? "var(--vscode-editor-selectionBackground) !important"
          : "inherit"};
  }
`;

interface DataGridRowProps {
  focused?: boolean;
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
  "data-testid"?: string;
}

/**
 * Optional component for encompasing a single row in a `DataGrid`.
 * Implements hover and focus states that highlight all cells in the row.
 *
 * Note that using this component is not mandatory. Cells can be placed directly
 * inside a `DataGrid`. Feel free to skip this component if your cells do not
 * line up into neat rows, or you do not need the hover and focus states.
 */
export const DataGridRow = forwardRef(
  (
    {
      focused,
      selected,
      children,
      "data-testid": testId,
      onClick,
    }: DataGridRowProps,
    ref?: React.Ref<HTMLElement | undefined>,
  ) => (
    <StyledDataGridRow
      $focused={focused}
      $selected={selected}
      ref={ref}
      data-testid={testId}
      onClick={onClick}
    >
      {children}
    </StyledDataGridRow>
  ),
);
DataGridRow.displayName = "DataGridRow";

const StyledDataGridCell = styled.div<{
  $rowType: "default" | "header";
  $gridRow?: string | number;
  $gridColumn?: string | number;
}>`
  ${({ $rowType }) => ($rowType === "header" ? "font-weight: 600;" : "")}
  ${({ $gridRow }) => ($gridRow ? `grid-row: ${$gridRow};` : "")}
  ${({ $gridColumn }) => ($gridColumn ? `grid-column: ${$gridColumn};` : "")}
  padding: 4px 12px;
`;

interface DataGridCellProps {
  rowType?: "default" | "header";
  gridRow?: string | number;
  gridColumn?: string | number;
  className?: string;
  children: ReactNode;
}

/**
 * A cell in a `DataGrid`.
 *
 * By default, the position of cells in the grid is determined by the order in which
 * they appear in the DOM. Cells will fill up the current row and then move on to the
 * next row. This can be overridden using the `gridRow` and `gridColumn` to place
 * cells anywhere within the grid. You can also configure cells to span multiple rows
 * or columns. See https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column.
 */
export const DataGridCell = forwardRef(
  (
    {
      rowType = "default",
      gridRow,
      gridColumn,
      className,
      children,
    }: DataGridCellProps,
    ref?: React.Ref<HTMLElement | undefined>,
  ) => {
    return (
      <StyledDataGridCell
        $rowType={rowType}
        $gridRow={gridRow}
        $gridColumn={gridColumn}
        className={className}
        ref={ref}
      >
        {children}
      </StyledDataGridCell>
    );
  },
);
DataGridCell.displayName = "DataGridCell";
