import { act, render as reactRender, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisStatus,
} from "../../../variant-analysis/shared/variant-analysis";
import type { VariantAnalysisAnalyzedReposProps } from "../VariantAnalysisAnalyzedRepos";
import { VariantAnalysisAnalyzedRepos } from "../VariantAnalysisAnalyzedRepos";
import { createMockVariantAnalysis } from "../../../../test/factories/variant-analysis/shared/variant-analysis";
import { createMockRepositoryWithMetadata } from "../../../../test/factories/variant-analysis/shared/repository";
import { createMockScannedRepo } from "../../../../test/factories/variant-analysis/shared/scanned-repositories";
import { SortKey } from "../../../variant-analysis/shared/variant-analysis-filter-sort";
import { permissiveFilterSortState } from "../../../../test/unit-tests/variant-analysis-filter-sort.test";
import { ResultFormat } from "../../../variant-analysis/shared/variant-analysis-result-format";

describe(VariantAnalysisAnalyzedRepos.name, () => {
  const defaultVariantAnalysis = createMockVariantAnalysis({
    status: VariantAnalysisStatus.InProgress,
    scannedRepos: [
      {
        ...createMockScannedRepo(),
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 1,
          fullName: "octodemo/hello-world-1",
          private: false,
          stargazersCount: 5_000,
        },
        resultCount: undefined,
        analysisStatus: VariantAnalysisRepoStatus.Pending,
      },
      {
        ...createMockScannedRepo(),
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 2,
          fullName: "octodemo/hello-world-2",
          private: false,
          stargazersCount: 20_000,
        },
        resultCount: 200,
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
      },
      {
        ...createMockScannedRepo(),
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 3,
          fullName: "octodemo/hello-world-3",
          private: true,
          stargazersCount: 20,
        },
        resultCount: undefined,
        analysisStatus: VariantAnalysisRepoStatus.Failed,
      },
      {
        ...createMockScannedRepo(),
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 4,
          fullName: "octodemo/hello-world-4",
          private: false,
          stargazersCount: 8_000,
        },
        resultCount: undefined,
        analysisStatus: VariantAnalysisRepoStatus.InProgress,
      },
      {
        ...createMockScannedRepo(),
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 5,
          fullName: "octodemo/hello-world-5",
          private: false,
          stargazersCount: 50_000,
        },
        resultCount: 55_323,
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
      },
      {
        ...createMockScannedRepo(),
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 6,
          fullName: "octodemo/hello-world-6",
          private: false,
          stargazersCount: 1,
        },
        resultCount: 10_000,
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
      },
    ],
  });

  const render = (props: Partial<VariantAnalysisAnalyzedReposProps> = {}) => {
    return reactRender(
      <VariantAnalysisAnalyzedRepos
        variantAnalysis={defaultVariantAnalysis}
        resultFormat={ResultFormat.Alerts}
        {...props}
      />,
    );
  };

  it("renders the repository names", () => {
    render();

    expect(screen.getByText("octodemo/hello-world-1")).toBeInTheDocument();
    expect(screen.getByText("octodemo/hello-world-2")).toBeInTheDocument();
    expect(screen.getByText("octodemo/hello-world-3")).toBeInTheDocument();
    expect(screen.getByText("octodemo/hello-world-4")).toBeInTheDocument();
  });

  it("renders the interpreted result for a succeeded repo", async () => {
    render({
      repositoryStates: [
        {
          repositoryId: 2,
          downloadStatus:
            VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
        },
      ],
      repositoryResults: [
        {
          variantAnalysisId: 1,
          repositoryId: 2,
          interpretedResults: [
            {
              message: {
                tokens: [
                  {
                    t: "text",
                    text: "This is an empty block.",
                  },
                ],
              },
              shortDescription: "This is an empty block.",
              fileLink: {
                fileLinkPrefix:
                  "https://github.com/facebook/create-react-app/blob/f34d88e30c7d8be7181f728d1abc4fd8d5cd07d3",
                filePath: "packages/create-react-app/createReactApp.js",
              },
              severity: "Warning",
              codeFlows: [],
            },
          ],
        },
      ],
    });

    expect(
      screen.queryByText("This is an empty block."),
    ).not.toBeInTheDocument();

    await act(async () => {
      await userEvent.click(
        screen.getByRole("button", {
          name: /octodemo\/hello-world-2/,
        }),
      );
    });

    expect(screen.getByText("This is an empty block.")).toBeInTheDocument();
  });

  it("uses the search value", () => {
    render({
      filterSortState: {
        ...permissiveFilterSortState,
        searchValue: "world-2",
      },
    });

    expect(
      screen.queryByText("octodemo/hello-world-1"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("octodemo/hello-world-2")).toBeInTheDocument();
    expect(
      screen.queryByText("octodemo/hello-world-3"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("octodemo/hello-world-4"),
    ).not.toBeInTheDocument();
  });

  it("uses the sort key", async () => {
    render({
      filterSortState: {
        ...permissiveFilterSortState,
        sortKey: SortKey.Popularity,
      },
    });

    const rows = screen.queryAllByRole("button");

    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent("octodemo/hello-world-5");
    expect(rows[1]).toHaveTextContent("octodemo/hello-world-2");
    expect(rows[2]).toHaveTextContent("octodemo/hello-world-4");
    expect(rows[3]).toHaveTextContent("octodemo/hello-world-1");
    expect(rows[4]).toHaveTextContent("octodemo/hello-world-3");
    expect(rows[5]).toHaveTextContent("octodemo/hello-world-6");
  });

  it("uses the 'Number of results' sort key", async () => {
    render({
      filterSortState: {
        ...permissiveFilterSortState,
        sortKey: SortKey.NumberOfResults,
      },
    });

    const rows = screen.queryAllByRole("button");

    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent("octodemo/hello-world-5");
    expect(rows[1]).toHaveTextContent("octodemo/hello-world-6");
    expect(rows[2]).toHaveTextContent("octodemo/hello-world-2");
    expect(rows[3]).toHaveTextContent("octodemo/hello-world-1");
    expect(rows[4]).toHaveTextContent("octodemo/hello-world-3");
    expect(rows[5]).toHaveTextContent("octodemo/hello-world-4");
  });
});
