import { render as reactRender, screen } from "@testing-library/react";
import { VariantAnalysisLoading } from "../VariantAnalysisLoading";

describe(VariantAnalysisLoading.name, () => {
  const render = () => reactRender(<VariantAnalysisLoading />);

  it("renders loading text", async () => {
    render();

    expect(
      screen.getByText("We are getting everything ready"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Results will appear here shortly"),
    ).toBeInTheDocument();
  });
});
