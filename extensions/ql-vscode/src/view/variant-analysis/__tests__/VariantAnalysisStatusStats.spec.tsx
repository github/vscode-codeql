import { render as reactRender, screen } from "@testing-library/react";
import { VariantAnalysisStatus } from "../../../variant-analysis/shared/variant-analysis";
import type { VariantAnalysisStatusStatsProps } from "../VariantAnalysisStatusStats";
import { VariantAnalysisStatusStats } from "../VariantAnalysisStatusStats";
import { formatDate } from "../../../common/date";

describe(VariantAnalysisStatusStats.name, () => {
  const render = (props: Partial<VariantAnalysisStatusStatsProps> = {}) =>
    reactRender(
      <VariantAnalysisStatusStats
        variantAnalysisStatus={VariantAnalysisStatus.InProgress}
        {...props}
      />,
    );

  it("renders an in-progress status correctly", () => {
    const { container } = render({
      variantAnalysisStatus: VariantAnalysisStatus.InProgress,
    });

    expect(
      container.getElementsByClassName(
        "codicon codicon-loading codicon-modifier-spin",
      )[0],
    ).toBeInTheDocument();
  });

  it("renders when there is a completedAt date", () => {
    const completedAt = new Date();
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      completedAt,
    });

    expect(screen.getByText(formatDate(completedAt))).toBeInTheDocument();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
  });

  it("renders when there isn't a completedAt date", () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      completedAt: undefined,
    });

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders when there is a viewLogs links", () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      onViewLogsClick: () => undefined,
    });

    expect(screen.getByText("View actions logs")).toBeInTheDocument();
  });

  it("renders when there isn't a viewLogs links", () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      onViewLogsClick: undefined,
    });

    expect(screen.queryByText("View actions logs")).not.toBeInTheDocument();
  });
});
