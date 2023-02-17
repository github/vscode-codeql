import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import {
  VariantAnalysisFailureReason,
  VariantAnalysisStatus,
} from "../../../variant-analysis/shared/variant-analysis";
import { VariantAnalysis, VariantAnalysisProps } from "../VariantAnalysis";
import { createMockVariantAnalysis } from "../../../../test/factories/variant-analysis/shared/variant-analysis";

describe(VariantAnalysis.name, () => {
  const render = (props: Partial<VariantAnalysisProps> = {}) =>
    reactRender(
      <VariantAnalysis
        variantAnalysis={createMockVariantAnalysis({})}
        {...props}
      />,
    );

  it("renders a pending analysis", () => {
    const variantAnalysis = createMockVariantAnalysis({
      status: VariantAnalysisStatus.InProgress,
    });
    variantAnalysis.actionsWorkflowRunId = undefined;
    render({ variantAnalysis });

    expect(
      screen.getByText("We are getting everything ready"),
    ).toBeInTheDocument();
  });

  it("renders an analysis where there were no repos to analyse", () => {
    const variantAnalysis = createMockVariantAnalysis({
      status: VariantAnalysisStatus.Failed,
    });
    variantAnalysis.failureReason = VariantAnalysisFailureReason.NoReposQueried;
    variantAnalysis.actionsWorkflowRunId = undefined;
    render({ variantAnalysis });

    expect(
      screen.queryByText("We are getting everything ready"),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(
        "No repositories available after processing. No repositories were analyzed.",
      ),
    ).toBeInTheDocument();
  });
});
