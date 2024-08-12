import { render as reactRender, screen } from "@testing-library/react";
import { AlertTableResultRow } from "../AlertTableResultRow";
import type { Props } from "../AlertTableResultRow";
import { createMockResults } from "../../../../test/factories/results/mockresults";

describe(AlertTableResultRow.name, () => {
  const render = (props?: Props) => {
    const mockRef = { current: null } as React.RefObject<HTMLTableRowElement>;
    const results = createMockResults();

    reactRender(
      <AlertTableResultRow
        result={results[0]}
        expanded={new Set()}
        resultIndex={1}
        selectedItem={undefined}
        selectedItemRef={mockRef}
        databaseUri={"dbUri"}
        sourceLocationPrefix="src"
        userSettings={{ shouldShowProvenance: false }}
        updateSelectionCallback={jest.fn()}
        toggleExpanded={jest.fn()}
        {...props}
      />,
    );
  };

  it("renders shortest path badge", () => {
    render();

    expect(screen.getByTitle("Shortest path")).toHaveTextContent("3");
  });
});
