import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VariantAnalysisStatus } from "../../../remote-queries/shared/variant-analysis";
import { VariantAnalysisActions } from "../VariantAnalysisActions";

describe(VariantAnalysisActions.name, () => {
  const onStopQueryClick = jest.fn();
  const onCopyRepositoryListClick = jest.fn();
  const onExportResultsClick = jest.fn();

  afterEach(() => {
    onStopQueryClick.mockReset();
    onCopyRepositoryListClick.mockReset();
    onExportResultsClick.mockReset();
  });

  const render = (variantAnalysisStatus: VariantAnalysisStatus) =>
    reactRender(
      <VariantAnalysisActions
        variantAnalysisStatus={variantAnalysisStatus}
        onStopQueryClick={onStopQueryClick}
        onCopyRepositoryListClick={onCopyRepositoryListClick}
        onExportResultsClick={onExportResultsClick}
      />,
    );

  it("renders 1 button when in progress", async () => {
    const { container } = render(VariantAnalysisStatus.InProgress);

    expect(container.querySelectorAll("vscode-button").length).toEqual(1);
  });

  it("renders the stop query button when in progress", async () => {
    render(VariantAnalysisStatus.InProgress);

    await userEvent.click(screen.getByText("Stop query"));
    expect(onStopQueryClick).toHaveBeenCalledTimes(1);
  });

  it("renders 2 buttons when succeeded", async () => {
    const { container } = render(VariantAnalysisStatus.Succeeded);

    expect(container.querySelectorAll("vscode-button").length).toEqual(2);
  });

  it("renders the copy repository list button when succeeded", async () => {
    render(VariantAnalysisStatus.Succeeded);

    await userEvent.click(screen.getByText("Copy repository list"));
    expect(onCopyRepositoryListClick).toHaveBeenCalledTimes(1);
  });

  it("renders the export results button when succeeded", async () => {
    render(VariantAnalysisStatus.Succeeded);

    await userEvent.click(screen.getByText("Export results"));
    expect(onExportResultsClick).toHaveBeenCalledTimes(1);
  });

  it("does not render any buttons when failed", () => {
    const { container } = render(VariantAnalysisStatus.Failed);

    expect(container.querySelectorAll("vscode-button").length).toEqual(0);
  });
});
