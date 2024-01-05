import { render as reactRender, screen } from "@testing-library/react";
import type { DataFlowPathsProps } from "../DataFlowPaths";
import { DataFlowPaths } from "../DataFlowPaths";
import { createMockDataFlowPaths } from "../../../../test/factories/variant-analysis/shared/data-flow-paths";

describe(DataFlowPaths.name, () => {
  const render = (props: DataFlowPathsProps) =>
    reactRender(<DataFlowPaths {...props} />);

  it("renders data flow paths", () => {
    const dataFlowPaths = createMockDataFlowPaths();

    render({ dataFlowPaths });

    expect(screen.getByText(dataFlowPaths.ruleDescription)).toBeInTheDocument();
    expect(
      screen.getByText("1 paths available", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("3 steps in", {
        exact: false,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("This zip file may have a dangerous path", {
        exact: false,
      }),
    ).toBeInTheDocument();
  });
});
