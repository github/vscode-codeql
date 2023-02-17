import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodePaths, CodePathsProps } from "../CodePaths";

import { createMockCodeFlows } from "../../../../../test/factories/variant-analysis/shared/CodeFlow";
import { createMockAnalysisMessage } from "../../../../../test/factories/variant-analysis/shared/AnalysisMessage";

describe(CodePaths.name, () => {
  const render = (props?: CodePathsProps) =>
    reactRender(
      <CodePaths
        codeFlows={createMockCodeFlows()}
        ruleDescription="Rule description"
        message={createMockAnalysisMessage()}
        severity="Recommendation"
        {...props}
      />,
    );

  it("renders correctly when unexpanded", () => {
    render();

    expect(screen.getByText("Show paths")).toBeInTheDocument();
    expect(screen.queryByText("Code snippet text")).not.toBeInTheDocument();
    expect(screen.queryByText("Rule description")).not.toBeInTheDocument();
  });

  it("renders correctly when expanded", async () => {
    render();

    await userEvent.click(screen.getByText("Show paths"));

    expect(screen.getByText("Code snippet text")).toBeInTheDocument();
    expect(screen.getByText("Rule description")).toBeInTheDocument();
  });
});
