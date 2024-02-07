import {
  act,
  render as reactRender,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepositoryDownloadStatus,
} from "../../../variant-analysis/shared/variant-analysis";
import { userEvent } from "@testing-library/user-event";
import type { RepoRowProps } from "../RepoRow";
import { RepoRow } from "../RepoRow";
import { createMockRepositoryWithMetadata } from "../../../../test/factories/variant-analysis/shared/repository";

describe(RepoRow.name, () => {
  const render = (props: Partial<RepoRowProps> = {}) => {
    return reactRender(
      <RepoRow
        repository={{
          ...createMockRepositoryWithMetadata(),
          id: 1,
          fullName: "octodemo/hello-world-1",
          private: false,
        }}
        status={VariantAnalysisRepoStatus.Pending}
        {...props}
      />,
    );
  };

  it("renders the pending state", () => {
    render();

    expect(screen.getByText("octodemo/hello-world-1")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();

    expect(
      screen.queryByRole("img", {
        // There should not be any icons, except for the icons which are always shown
        name: (name) => !["expand", "stars count"].includes(name.toLowerCase()),
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        expanded: false,
      }),
    ).toBeDisabled();
  });

  it("renders the in progress state", () => {
    render({
      status: VariantAnalysisRepoStatus.InProgress,
    });

    expect(
      screen.getByRole("img", {
        name: "In progress",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        expanded: false,
      }),
    ).toBeDisabled();
  });

  it("renders the succeeded state without download status", () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
      resultCount: 178,
    });

    expect(
      screen.getByRole("img", {
        name: "Success",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("178")).toBeInTheDocument();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        expanded: false,
      }),
    ).toBeDisabled();
  });

  it("renders the succeeded state with pending download status", () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
      resultCount: 178,
      downloadState: {
        repositoryId: 1,
        downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Pending,
      },
    });

    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        expanded: false,
      }),
    ).toBeDisabled();
  });

  it("renders the succeeded state with in progress download status", () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
      resultCount: 178,
      downloadState: {
        repositoryId: 1,
        downloadStatus:
          VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
      },
    });

    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        expanded: false,
      }),
    ).toBeDisabled();
  });

  it("renders the succeeded state with succeeded download status", () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
      resultCount: 178,
      downloadState: {
        repositoryId: 1,
        downloadStatus:
          VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
      },
    });

    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        expanded: false,
      }),
    ).toBeEnabled();
  });

  it("renders the succeeded state with failed download status", () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
      resultCount: 178,
      downloadState: {
        repositoryId: 1,
        downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Failed,
      },
    });

    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        expanded: false,
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("img", {
        name: "Failed to download the results",
      }),
    ).toBeInTheDocument();
  });

  it("renders the failed state", () => {
    render({
      status: VariantAnalysisRepoStatus.Failed,
    });

    expect(
      screen.getByRole("img", {
        name: "Failed",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        expanded: false,
      }),
    ).toBeEnabled();
  });

  it("renders the timed out state", () => {
    render({
      status: VariantAnalysisRepoStatus.TimedOut,
    });

    expect(
      screen.getByRole("img", {
        name: "Timed out",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        expanded: false,
      }),
    ).toBeEnabled();
  });

  it("renders the canceled state", () => {
    render({
      status: VariantAnalysisRepoStatus.Canceled,
    });

    expect(
      screen.getByRole("img", {
        name: "Canceled",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        expanded: false,
      }),
    ).toBeEnabled();
  });

  it("shows repository name", async () => {
    render({
      repository: {
        fullName: "octodemo/hello-world",
      },
    });

    expect(screen.getByText("octodemo/hello-world")).toBeInTheDocument();
  });

  it("shows visibility when public", () => {
    render({
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 1,
        fullName: "octodemo/hello-world-1",
        private: false,
      },
    });

    expect(screen.getByText("public")).toBeInTheDocument();
  });

  it("shows visibility when private", () => {
    render({
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 1,
        fullName: "octodemo/hello-world-1",
        private: true,
      },
    });

    expect(screen.getByText("private")).toBeInTheDocument();
  });

  it("does not show visibility when unknown", () => {
    render({
      repository: {
        id: undefined,
        fullName: "octodemo/hello-world-1",
        private: undefined,
      },
    });

    expect(screen.queryByText("public")).not.toBeInTheDocument();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
  });

  it("shows stars", () => {
    render({
      repository: {
        ...createMockRepositoryWithMetadata(),
        stargazersCount: 57_378,
      },
    });

    expect(screen.getByText("57k")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Stars count",
      }),
    ).toBeInTheDocument();
  });

  it("does not show star count when unknown", () => {
    render({
      repository: {
        id: undefined,
        fullName: "octodemo/hello-world-1",
        private: undefined,
      },
    });

    expect(
      screen.queryByRole("img", {
        name: "Stars count",
      }),
    ).not.toBeInTheDocument();
  });

  it("can expand the repo item", async () => {
    render({
      status: VariantAnalysisRepoStatus.TimedOut,
    });

    await act(async () => {
      await userEvent.click(
        screen.getByRole("button", {
          expanded: false,
        }),
      );
    });

    screen.getByRole("button", {
      expanded: true,
    });
    screen.getByText("Error: Timed out");
  });

  it("can expand the repo item when succeeded and loaded", async () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
      downloadState: {
        repositoryId: 1,
        downloadStatus:
          VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
      },
      interpretedResults: [],
    });

    await act(async () => {
      await userEvent.click(
        screen.getByRole("button", {
          expanded: false,
        }),
      );
    });

    expect(
      screen.getByRole("button", {
        expanded: true,
      }),
    ).toBeInTheDocument();
  });

  it("can expand the repo item when succeeded and not loaded", async () => {
    const { rerender } = render({
      status: VariantAnalysisRepoStatus.Succeeded,
      downloadState: {
        repositoryId: 1,
        downloadStatus:
          VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
      },
    });

    await act(async () => {
      await userEvent.click(
        screen.getByRole("button", {
          expanded: false,
        }),
      );
    });

    expect(window.vsCodeApi.postMessage).toHaveBeenCalledWith({
      t: "requestRepositoryResults",
      repositoryFullName: "octodemo/hello-world-1",
    });

    expect(
      screen.getByRole("button", {
        expanded: false,
      }),
    ).toBeInTheDocument();

    rerender(
      <RepoRow
        repository={{
          ...createMockRepositoryWithMetadata(),
          id: 1,
          fullName: "octodemo/hello-world-1",
          private: false,
        }}
        status={VariantAnalysisRepoStatus.Succeeded}
        interpretedResults={[]}
      />,
    );

    expect(
      screen.getByRole("button", {
        expanded: true,
      }),
    ).toBeInTheDocument();
  });

  it("does not allow expanding the repo item when status is undefined", async () => {
    render({
      status: undefined,
    });

    expect(
      screen.getByRole("button", {
        expanded: false,
      }),
    ).toBeDisabled();
  });

  it("does not allow selecting the item if the item has not succeeded", async () => {
    render({
      status: VariantAnalysisRepoStatus.InProgress,
    });

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("does not allow selecting the item if the item has not been downloaded", async () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
    });

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("does not allow selecting the item if the item has not been downloaded successfully", async () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
      downloadState: {
        repositoryId: 1,
        downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Failed,
      },
    });

    // It seems like sometimes the first render doesn't have the checkbox disabled
    // Might be related to https://github.com/microsoft/vscode-webview-ui-toolkit/issues/404
    await waitFor(() => {
      expect(screen.getByRole("checkbox")).toBeDisabled();
    });
  });

  it("allows selecting the item if the item has been downloaded", async () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
      downloadState: {
        repositoryId: 1,
        downloadStatus:
          VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
      },
    });

    expect(screen.getByRole("checkbox")).toBeEnabled();
  });
});
