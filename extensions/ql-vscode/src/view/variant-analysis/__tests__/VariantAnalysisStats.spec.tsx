import { render as reactRender, screen } from "@testing-library/react";
import { VariantAnalysisStatus } from "../../../variant-analysis/shared/variant-analysis";
import type { VariantAnalysisStatsProps } from "../VariantAnalysisStats";
import { VariantAnalysisStats } from "../VariantAnalysisStats";
import { userEvent } from "@testing-library/user-event";

describe(VariantAnalysisStats.name, () => {
  const onViewLogsClick = jest.fn();

  afterEach(() => {
    onViewLogsClick.mockReset();
  });

  const render = (props: Partial<VariantAnalysisStatsProps> = {}) =>
    reactRender(
      <VariantAnalysisStats
        variantAnalysisStatus={VariantAnalysisStatus.InProgress}
        totalRepositoryCount={10}
        completedRepositoryCount={0}
        successfulRepositoryCount={0}
        skippedRepositoryCount={0}
        onViewLogsClick={onViewLogsClick}
        createdAt={new Date()}
        {...props}
      />,
    );

  it("renders correctly", () => {
    render();

    expect(screen.getByText("Results")).toBeInTheDocument();
  });

  it("renders the number of results as a formatted number", () => {
    render({ resultCount: 123456 });

    expect(screen.getByText("123,456")).toBeInTheDocument();
    expect(screen.queryAllByText("-").length).toBe(1);
  });

  it("renders the number of successful repositories as a formatted number", () => {
    render({
      totalRepositoryCount: 123456,
      successfulRepositoryCount: 654321,
    });

    expect(screen.getByText("654,321/123,456")).toBeInTheDocument();
  });

  it("renders a warning icon when skippedRepositoryCount is greater than zero", () => {
    render({ skippedRepositoryCount: 4 });

    expect(
      screen.getByRole("img", {
        name: "Some repositories were skipped",
      }),
    ).toBeInTheDocument();
  });

  it("renders an error icon when the variant analysis status is failed", () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Failed });

    expect(
      screen.getByRole("img", {
        name: "Variant analysis failed",
      }),
    ).toBeInTheDocument();
  });

  it("renders a completed icon when the variant analysis status is succeeded", () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Succeeded });

    expect(
      screen.getByRole("img", {
        name: "Completed",
      }),
    ).toBeInTheDocument();
  });

  it("renders an error icon when the overall variant analysis status is in progress but some analyses failed", () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.InProgress,
      completedRepositoryCount: 10,
      successfulRepositoryCount: 5,
    });

    expect(
      screen.getByRole("img", {
        name: "Some analyses failed",
      }),
    ).toBeInTheDocument();
  });

  it("renders an error icon when the overall variant analysis status is succeeded but some analyses failed", () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      completedRepositoryCount: 10,
      successfulRepositoryCount: 5,
    });

    expect(
      screen.getByRole("img", {
        name: "Some analyses failed",
      }),
    ).toBeInTheDocument();
  });

  it("renders an error icon when the overall variant analysis status is canceled and some analyses failed", () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Canceled,
      completedRepositoryCount: 10,
      successfulRepositoryCount: 5,
    });

    expect(
      screen.getByRole("img", {
        name: "Some analyses were stopped",
      }),
    ).toBeInTheDocument();
  });

  it("renders an error icon when some analyses failed but also some repositories were skipped", () => {
    render({
      completedRepositoryCount: 10,
      successfulRepositoryCount: 5,
      skippedRepositoryCount: 2,
    });

    expect(
      screen.getByRole("img", {
        name: "Some analyses failed",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", {
        name: "Some repositories were skipped",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders 'View logs' link when the variant analysis status is succeeded", async () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      completedAt: new Date(),
    });

    await userEvent.click(screen.getByText("View actions logs"));
    expect(onViewLogsClick).toHaveBeenCalledTimes(1);
  });

  it("renders 'Running' text when the variant analysis status is in progress", () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.InProgress });

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("renders 'Failed' text when the variant analysis status is failed", () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Failed });

    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders 'Stopping' text when the variant analysis status is canceling", () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Canceling });

    expect(screen.getByText("Canceling")).toBeInTheDocument();
  });

  it("renders 'Stopped' text when the variant analysis status is canceled", () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Canceled });

    expect(screen.getByText("Stopped")).toBeInTheDocument();
  });

  it("renders 'Some analyses failed' text when the overall variant analysis status is succeeded but not all analyses successful", () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      completedRepositoryCount: 10,
      successfulRepositoryCount: 5,
    });

    expect(screen.getByText("Some analyses failed")).toBeInTheDocument();
  });

  it("renders 'Succeeded' text when the variant analysis status is succeeded and successful repository count omitted", () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Succeeded });

    expect(screen.getByText("Succeeded")).toBeInTheDocument();
  });

  it("renders 'Succeeded' text when the variant analysis status is succeeded and successful repository count equals total repository count", () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      completedRepositoryCount: 10,
      successfulRepositoryCount: 10,
    });

    expect(screen.getByText("Succeeded")).toBeInTheDocument();
  });

  it("does not render the duration when the completedAt is not set", () => {
    render({ createdAt: new Date("2021-05-01T00:00:00Z") });

    expect(screen.queryAllByText("-").length).toBe(2);
    expect(screen.queryByText("Less than a second")).not.toBeInTheDocument();
  });

  it("renders the duration when it is less than a second", () => {
    render({
      createdAt: new Date("2021-05-01T00:00:00Z"),
      completedAt: new Date("2021-05-01T00:00:00Z"),
    });

    expect(screen.getByText("Less than a second")).toBeInTheDocument();
    expect(screen.queryAllByText("-").length).toBe(1);
  });

  it("renders the duration when it is less than a minute", () => {
    render({
      createdAt: new Date("2021-05-01T00:00:00Z"),
      completedAt: new Date("2021-05-01T00:00:34Z"),
    });

    expect(screen.getByText("34 seconds")).toBeInTheDocument();
  });

  it("renders the duration when it is more than a minute", () => {
    render({
      createdAt: new Date("2021-05-01T00:00:00Z"),
      completedAt: new Date("2021-05-01T00:10:22Z"),
    });

    expect(screen.getByText("10 minutes")).toBeInTheDocument();
  });
});
