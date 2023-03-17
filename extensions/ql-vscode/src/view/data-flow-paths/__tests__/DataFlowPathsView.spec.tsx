import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import {
  DataFlowPathsView,
  DataFlowPathsViewProps,
} from "../DataFlowPathsView";
import { createMockDataFlowPaths } from "../../../../test/factories/variant-analysis/shared/data-flow-paths";

describe(DataFlowPathsView.name, () => {
  const render = (props: Partial<DataFlowPathsViewProps>) =>
    reactRender(<DataFlowPathsView {...props} />);

  it("renders a loading data flow paths view", () => {
    render({});

    expect(screen.getByText("Loading data flow paths")).toBeInTheDocument();
  });

  it("renders a data flow paths view", () => {
    render({ dataFlowPaths: createMockDataFlowPaths() });

    expect(screen.getByText("Loaded")).toBeInTheDocument();
  });
});
