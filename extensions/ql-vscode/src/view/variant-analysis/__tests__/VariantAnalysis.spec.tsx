import * as React from "react";
import { act, render as reactRender, screen } from "@testing-library/react";
import {
  VariantAnalysisFailureReason,
  VariantAnalysisStatus,
} from "../../../variant-analysis/shared/variant-analysis";
import { VariantAnalysis, VariantAnalysisProps } from "../VariantAnalysis";
import { createMockVariantAnalysis } from "../../../../test/factories/variant-analysis/shared/variant-analysis";
import { ToVariantAnalysisMessage } from "../../../pure/interface-types";
import { FilterKey, SortKey } from "../../../pure/variant-analysis-filter-sort";

describe(VariantAnalysis.name, () => {
  const render = (props: Partial<VariantAnalysisProps> = {}) =>
    reactRender(
      <VariantAnalysis
        variantAnalysis={createMockVariantAnalysis({})}
        {...props}
      />,
    );

  const postMessage = async (msg: ToVariantAnalysisMessage) => {
    await act(async () => {
      // window.postMessage doesn't set the origin correctly, see
      // https://github.com/jsdom/jsdom/issues/2745
      window.dispatchEvent(
        new MessageEvent("message", {
          source: window,
          origin: window.location.origin,
          data: msg,
        }),
      );

      // The event is dispatched asynchronously, so we need to wait for it to be handled.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

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

    // Without this await, `getByDisplayValue` could not find any selected dropdown option.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByDisplayValue("With results")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Number of results")).toBeInTheDocument();

    await postMessage({
      t: "setVariantAnalysis",
      variantAnalysis,
      filterSortState: {
        searchValue: "",
        filterKey: FilterKey.All,
        sortKey: SortKey.Alphabetically,
      },
    });

    expect(screen.getByDisplayValue("All")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alphabetically")).toBeInTheDocument();

    expect(screen.queryByDisplayValue("With results")).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("Number of results"),
    ).not.toBeInTheDocument();
  });
});
