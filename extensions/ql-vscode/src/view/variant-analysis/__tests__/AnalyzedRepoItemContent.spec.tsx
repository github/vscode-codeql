import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepositoryDownloadStatus,
} from "../../../variant-analysis/shared/variant-analysis";
import {
  AnalyzedRepoItemContent,
  AnalyzedRepoItemContentProps,
} from "../AnalyzedRepoItemContent";
import { ResultFormat } from "../../../variant-analysis/shared/variant-analysis-result-format";

describe(AnalyzedRepoItemContent.name, () => {
  const render = (props: Partial<AnalyzedRepoItemContentProps> = {}) => {
    return reactRender(
      <AnalyzedRepoItemContent
        status={VariantAnalysisRepoStatus.Succeeded}
        resultFormat={ResultFormat.Alerts}
        {...props}
      />,
    );
  };

  it("renders the succeeded state with interpreted results", () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
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
          codeSnippet: {
            startLine: 655,
            endLine: 662,
            text: "            try {\n              callback();\n            } catch (ignored) {\n              // Callback might throw and fail, since it's a temp directory the\n              // OS will clean it up eventually...\n            }\n          },\n        });\n",
          },
          highlightedRegion: {
            startLine: 657,
            startColumn: 31,
            endLine: 660,
            endColumn: 14,
          },
          codeFlows: [],
        },
      ],
    });

    expect(screen.getByText("This is an empty block.")).toBeInTheDocument();
  });

  it("renders the succeeded state with raw results", () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
      rawResults: {
        schema: {
          name: "#select",
          rows: 1,
          columns: [
            {
              kind: "i",
            },
          ],
        },
        resultSet: {
          schema: {
            name: "#select",
            rows: 1,
            columns: [
              {
                kind: "i",
              },
            ],
          },
          rows: [[60688]],
        },
        fileLinkPrefix:
          "https://github.com/octodemo/hello-world-1/blob/59a2a6c7d9dde7a6ecb77c2f7e8197d6925c143b",
        sourceLocationPrefix: "/home/runner/work/bulk-builder/bulk-builder",
        capped: false,
      },
    });

    expect(screen.getByText("60688")).toBeInTheDocument();
  });

  it("renders the failed state", () => {
    render({
      status: VariantAnalysisRepoStatus.Failed,
    });

    expect(screen.getByText("Error: Failed")).toBeInTheDocument();
  });

  it("renders the timed out state", () => {
    render({
      status: VariantAnalysisRepoStatus.TimedOut,
    });

    expect(screen.getByText("Error: Timed out")).toBeInTheDocument();
  });

  it("renders the canceled state", () => {
    render({
      status: VariantAnalysisRepoStatus.Canceled,
    });

    expect(screen.getByText("Error: Canceled")).toBeInTheDocument();
  });

  it("renders the failed download state", () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
      downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Failed,
    });

    expect(screen.getByText("Error: Download failed")).toBeInTheDocument();
  });
});
