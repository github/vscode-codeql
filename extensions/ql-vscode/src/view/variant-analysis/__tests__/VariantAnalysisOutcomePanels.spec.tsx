import { render as reactRender, screen } from "@testing-library/react";
import type { VariantAnalysis } from "../../../variant-analysis/shared/variant-analysis";
import {
  VariantAnalysisFailureReason,
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus,
} from "../../../variant-analysis/shared/variant-analysis";
import type { VariantAnalysisOutcomePanelProps } from "../VariantAnalysisOutcomePanels";
import { VariantAnalysisOutcomePanels } from "../VariantAnalysisOutcomePanels";
import { createMockVariantAnalysis } from "../../../../test/factories/variant-analysis/shared/variant-analysis";
import { createMockRepositoryWithMetadata } from "../../../../test/factories/variant-analysis/shared/repository";
import {
  createMockScannedRepo,
  createMockScannedRepos,
} from "../../../../test/factories/variant-analysis/shared/scanned-repositories";
import { defaultFilterSortState } from "../../../variant-analysis/shared/variant-analysis-filter-sort";

describe(VariantAnalysisOutcomePanels.name, () => {
  const defaultVariantAnalysis = {
    ...createMockVariantAnalysis({ status: VariantAnalysisStatus.InProgress }),
    controllerRepo: {
      id: 1,
      fullName: "octodemo/variant-analysis-controller",
      private: false,
    },
    actionsWorkflowRunId: 789263,
    executionStartTime: 1611234567890,
    createdAt: "2021-01-21T13:09:27.890Z",
    updatedAt: "2021-01-21T13:09:27.890Z",
    status: VariantAnalysisStatus.InProgress,
    scannedRepos: [
      {
        ...createMockScannedRepo(),
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 1,
          fullName: "octodemo/hello-world-1",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Pending,
      },
    ],
    skippedRepos: {
      notFoundRepos: {
        repositoryCount: 2,
        repositories: [
          {
            fullName: "octodemo/hello-globe",
          },
          {
            fullName: "octodemo/hello-planet",
          },
        ],
      },
      noCodeqlDbRepos: {
        repositoryCount: 4,
        repositories: [
          createMockRepositoryWithMetadata(),
          createMockRepositoryWithMetadata(),
          createMockRepositoryWithMetadata(),
          createMockRepositoryWithMetadata(),
        ],
      },
      overLimitRepos: {
        repositoryCount: 1,
        repositories: [createMockRepositoryWithMetadata()],
      },
      accessMismatchRepos: {
        repositoryCount: 1,
        repositories: [createMockRepositoryWithMetadata()],
      },
    },
  };

  const render = (
    variantAnalysis: Partial<VariantAnalysis> = {},
    props: Partial<VariantAnalysisOutcomePanelProps> = {},
  ) => {
    return reactRender(
      <VariantAnalysisOutcomePanels
        variantAnalysis={{
          ...defaultVariantAnalysis,
          ...variantAnalysis,
        }}
        filterSortState={defaultFilterSortState}
        setFilterSortState={jest.fn()}
        {...props}
      />,
    );
  };

  it("renders correctly", () => {
    render();

    expect(screen.getByText("Analyzed")).toBeInTheDocument();
  });

  it("does not render panels without skipped repos", () => {
    render({
      skippedRepos: undefined,
    });

    expect(screen.queryByText("Analyzed")).not.toBeInTheDocument();
    expect(screen.queryByText("No access")).not.toBeInTheDocument();
    expect(screen.queryByText("No database")).not.toBeInTheDocument();
  });

  it("renders panels with not found repos", () => {
    render({
      skippedRepos: {
        notFoundRepos: defaultVariantAnalysis.skippedRepos.notFoundRepos,
      },
    });

    expect(screen.getByText("Analyzed")).toBeInTheDocument();
    expect(screen.getByText("No access")).toBeInTheDocument();
    expect(screen.queryByText("No database")).not.toBeInTheDocument();
  });

  it("renders panels with no database repos", () => {
    render({
      skippedRepos: {
        noCodeqlDbRepos: defaultVariantAnalysis.skippedRepos.noCodeqlDbRepos,
      },
    });

    expect(screen.getByText("Analyzed")).toBeInTheDocument();
    expect(screen.queryByText("No access")).not.toBeInTheDocument();
    expect(screen.getByText("No database")).toBeInTheDocument();
  });

  it("renders panels with not found and no database repos", () => {
    render({
      skippedRepos: {
        notFoundRepos: defaultVariantAnalysis.skippedRepos.notFoundRepos,
        noCodeqlDbRepos: defaultVariantAnalysis.skippedRepos.noCodeqlDbRepos,
      },
    });

    expect(screen.getByText("Analyzed")).toBeInTheDocument();
    expect(screen.getByText("No access")).toBeInTheDocument();
    expect(screen.getByText("No database")).toBeInTheDocument();
  });

  it("does not render analyzed panel when there are no scanned repos", () => {
    render({
      scannedRepos: [],
      skippedRepos: {
        notFoundRepos: defaultVariantAnalysis.skippedRepos.notFoundRepos,
        noCodeqlDbRepos: defaultVariantAnalysis.skippedRepos.noCodeqlDbRepos,
      },
    });

    expect(screen.queryByRole("Analyzed")).not.toBeInTheDocument();
    expect(screen.getByText("No access")).toBeInTheDocument();
    expect(screen.getByText("No database")).toBeInTheDocument();
  });

  it("does not render any tabs when there are no repos", () => {
    render({
      status: VariantAnalysisStatus.Failed,
      failureReason: VariantAnalysisFailureReason.InternalError,
      scannedRepos: [],
      skippedRepos: {},
    });

    expect(screen.queryByRole("Analyzed")).not.toBeInTheDocument();
    expect(screen.queryByRole("No access")).not.toBeInTheDocument();
    expect(screen.queryByRole("No database")).not.toBeInTheDocument();
    expect(
      screen.getByText("Error: Something unexpected happened"),
    ).toBeInTheDocument();
  });

  it("renders warning with canceled variant analysis", () => {
    render({
      status: VariantAnalysisStatus.Canceled,
    });

    expect(
      screen.getByText("Warning: Variant analysis canceled"),
    ).toBeInTheDocument();
  });

  it("renders warning with access mismatch repos", () => {
    render({
      skippedRepos: {
        notFoundRepos: defaultVariantAnalysis.skippedRepos.notFoundRepos,
        accessMismatchRepos:
          defaultVariantAnalysis.skippedRepos.accessMismatchRepos,
      },
    });

    expect(
      screen.getByText("Warning: Problem with controller repository"),
    ).toBeInTheDocument();
  });

  it("renders warning with over limit repos", () => {
    render({
      skippedRepos: {
        overLimitRepos: defaultVariantAnalysis.skippedRepos.overLimitRepos,
      },
    });

    expect(
      screen.getByText("Warning: Repository list too large"),
    ).toBeInTheDocument();
  });

  it("renders singulars in warnings", () => {
    render({
      skippedRepos: {
        overLimitRepos: {
          repositoryCount: 1,
          repositories:
            defaultVariantAnalysis.skippedRepos.overLimitRepos.repositories,
        },
        accessMismatchRepos: {
          repositoryCount: 1,
          repositories:
            defaultVariantAnalysis.skippedRepos.overLimitRepos.repositories,
        },
      },
    });

    expect(
      screen.getByText(
        "Publicly visible controller repository can't be used to analyze private repositories. 1 private repository was not analyzed.",
      ),
    ).toBeInTheDocument();
  });

  it("renders plurals in warnings", () => {
    render({
      scannedRepos: createMockScannedRepos(),
      skippedRepos: {
        overLimitRepos: {
          repositoryCount: 2,
          repositories:
            defaultVariantAnalysis.skippedRepos.overLimitRepos.repositories,
        },
        accessMismatchRepos: {
          repositoryCount: 2,
          repositories:
            defaultVariantAnalysis.skippedRepos.overLimitRepos.repositories,
        },
      },
    });

    expect(
      screen.getByText(
        "Repository list contains more than 3 entries. Only the first 3 repositories were processed.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Publicly visible controller repository can't be used to analyze private repositories. 2 private repositories were not analyzed.",
      ),
    ).toBeInTheDocument();
  });
});
