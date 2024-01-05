import { render as reactRender, screen } from "@testing-library/react";
import type { DataFlowPathsViewProps } from "../DataFlowPathsView";
import { DataFlowPathsView } from "../DataFlowPathsView";
import { createMockCodeFlows } from "../../../../test/factories/variant-analysis/shared/CodeFlow";
import { createMockDataFlowPaths } from "../../../../test/factories/variant-analysis/shared/data-flow-paths";

describe(DataFlowPathsView.name, () => {
  const render = (props: Partial<DataFlowPathsViewProps>) =>
    reactRender(<DataFlowPathsView {...props} />);

  it("renders a loading data flow paths view", () => {
    render({});

    expect(screen.getByText("Loading data flow paths")).toBeInTheDocument();
  });

  it("renders a data flow paths view", () => {
    const dataFlowPaths = createMockDataFlowPaths({
      ruleDescription: "Rule description",
      codeFlows: createMockCodeFlows(),
    });

    render({ dataFlowPaths });

    expect(screen.queryByText("Code snippet text")).toBeInTheDocument();
    expect(screen.getByText("Rule description")).toBeInTheDocument();
  });
});
