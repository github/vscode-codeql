import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VariantAnalysisStatus } from "../../../variant-analysis/shared/variant-analysis";
import {
  VariantAnalysisActions,
  VariantAnalysisActionsProps,
} from "../VariantAnalysisActions";

describe(VariantAnalysisActions.name, () => {
  const onStopQueryClick = jest.fn();
  const onCopyRepositoryListClick = jest.fn();
  const onExportResultsClick = jest.fn();

  afterEach(() => {
    onStopQueryClick.mockReset();
    onCopyRepositoryListClick.mockReset();
    onExportResultsClick.mockReset();
  });

  const render = (
    props: Pick<VariantAnalysisActionsProps, "variantAnalysisStatus"> &
      Partial<VariantAnalysisActionsProps>,
  ) =>
    reactRender(
      <VariantAnalysisActions
        onStopQueryClick={onStopQueryClick}
        onCopyRepositoryListClick={onCopyRepositoryListClick}
        onExportResultsClick={onExportResultsClick}
        {...props}
      />,
    );

  it("renders 1 button when in progress", async () => {
    const { container } = render({
      variantAnalysisStatus: VariantAnalysisStatus.InProgress,
    });

    expect(container.querySelectorAll("vscode-button").length).toEqual(1);
  });

  it("renders the stop query button when in progress", async () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.InProgress,
    });

    await userEvent.click(screen.getByText("Stop query"));
    expect(onStopQueryClick).toHaveBeenCalledTimes(1);
  });

  it("renders 3 buttons when in progress with results", async () => {
    const { container } = render({
      variantAnalysisStatus: VariantAnalysisStatus.InProgress,
      showResultActions: true,
    });

    expect(container.querySelectorAll("vscode-button").length).toEqual(3);
  });

  it("renders 2 buttons when succeeded", async () => {
    const { container } = render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      showResultActions: true,
    });

    expect(container.querySelectorAll("vscode-button").length).toEqual(2);
  });

  it("renders the copy repository list button when succeeded", async () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      showResultActions: true,
    });

    await userEvent.click(screen.getByText("Copy repository list"));
    expect(onCopyRepositoryListClick).toHaveBeenCalledTimes(1);
  });

  it("renders the export results button when succeeded", async () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      showResultActions: true,
    });

    await userEvent.click(screen.getByText("Export results"));
    expect(onExportResultsClick).toHaveBeenCalledTimes(1);
  });

  it("does not render any buttons when failed", () => {
    const { container } = render({
      variantAnalysisStatus: VariantAnalysisStatus.Failed,
    });

    expect(container.querySelectorAll("vscode-button").length).toEqual(0);
  });

  it("changes the text on the buttons when repositories are selected", async () => {
    render({
      variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      showResultActions: true,
      hasSelectedRepositories: true,
    });

    expect(screen.getByText("Export selected results")).toBeInTheDocument();
    expect(
      screen.getByText("Copy selected repositories as a list"),
    ).toBeInTheDocument();
  });
});
