import { render as reactRender, screen } from "@testing-library/react";
import type { Props } from "../AlertTablePathRow";
import { AlertTablePathRow } from "../AlertTablePathRow";
import { createMockResults } from "../../../../test/factories/results/mockresults";

describe(AlertTablePathRow.name, () => {
  const render = (props?: Props) => {
    const mockRef = { current: null } as React.RefObject<HTMLTableRowElement>;
    const results = createMockResults();
    const threadFlow = results[0]?.codeFlows?.[0]?.threadFlows?.[0];

    if (!threadFlow) {
      throw new Error("ThreadFlow is undefined");
    }
    reactRender(
      <AlertTablePathRow
        resultIndex={1}
        selectedItem={undefined}
        selectedItemRef={mockRef}
        path={threadFlow}
        pathIndex={0}
        currentPathExpanded={true}
        databaseUri={"dbUri"}
        sourceLocationPrefix="src"
        userSettings={{ shouldShowProvenance: false }}
        updateSelectionCallback={jest.fn()}
        toggleExpanded={jest.fn()}
        {...props}
      />,
    );
  };

  it("renders number of steps", () => {
    render();

    expect(screen.getByText("Path (3 steps)")).toBeInTheDocument();
  });
});
