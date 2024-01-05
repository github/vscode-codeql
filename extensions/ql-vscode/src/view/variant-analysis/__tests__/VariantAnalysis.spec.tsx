import { render as reactRender, screen, waitFor } from "@testing-library/react";
import {
  VariantAnalysisFailureReason,
  VariantAnalysisStatus,
} from "../../../variant-analysis/shared/variant-analysis";
import type { VariantAnalysisProps } from "../VariantAnalysis";
import { VariantAnalysis } from "../VariantAnalysis";
import { createMockVariantAnalysis } from "../../../../test/factories/variant-analysis/shared/variant-analysis";
import type { ToVariantAnalysisMessage } from "../../../common/interface-types";
import {
  FilterKey,
  SortKey,
} from "../../../variant-analysis/shared/variant-analysis-filter-sort";
import { postMessage } from "../../common/post-message";

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

  it("renders results view with correct filter and sort state", async () => {
    const variantAnalysis = createMockVariantAnalysis({});
    render({ variantAnalysis });

    await waitFor(() => screen.getByDisplayValue("All"));
    await waitFor(() => screen.getByDisplayValue("Number of results"));

    await postMessage<ToVariantAnalysisMessage>({
      t: "setFilterSortState",
      filterSortState: {
        searchValue: "",
        filterKey: FilterKey.WithResults,
        sortKey: SortKey.Alphabetically,
      },
    });

    expect(screen.getByDisplayValue("With results")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alphabetically")).toBeInTheDocument();

    expect(screen.queryByDisplayValue("All")).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("Number of results"),
    ).not.toBeInTheDocument();
  });
});
