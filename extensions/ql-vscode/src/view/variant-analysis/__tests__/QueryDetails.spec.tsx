import { render as reactRender, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { QueryDetailsProps } from "../QueryDetails";
import { QueryDetails } from "../QueryDetails";

describe(QueryDetails.name, () => {
  const onOpenQueryFileClick = vi.fn();
  const onViewQueryTextClick = vi.fn();
  const onStopQueryClick = vi.fn();
  const onCopyRepositoryListClick = vi.fn();
  const onExportResultsClick = vi.fn();

  afterEach(() => {
    onOpenQueryFileClick.mockReset();
    onViewQueryTextClick.mockReset();
    onStopQueryClick.mockReset();
    onCopyRepositoryListClick.mockReset();
    onExportResultsClick.mockReset();
  });

  const render = (props: Partial<QueryDetailsProps> = {}) =>
    reactRender(
      <QueryDetails
        queryName="Query name"
        queryFileName="example.ql"
        onOpenQueryFileClick={onOpenQueryFileClick}
        onViewQueryTextClick={onViewQueryTextClick}
        {...props}
      />,
    );

  it("renders correctly", () => {
    render();

    expect(screen.getByText("Query name")).toBeInTheDocument();
  });

  it("renders the query file name as a button", async () => {
    render();

    await userEvent.click(screen.getByText("example.ql"));
    expect(onOpenQueryFileClick).toHaveBeenCalledTimes(1);
  });

  it("renders a view query button", async () => {
    render();

    await userEvent.click(screen.getByText("View query"));
    expect(onViewQueryTextClick).toHaveBeenCalledTimes(1);
  });
});
