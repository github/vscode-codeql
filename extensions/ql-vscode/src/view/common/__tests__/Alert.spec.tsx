import { render, screen } from "@testing-library/react";
import { Alert } from "../Alert";

describe(Alert.name, () => {
  it("renders a warning correctly", () => {
    render(
      <Alert type="warning" title="Warning title" message="Warning content" />,
    );

    expect(screen.getByText("Warning: Warning title")).toBeInTheDocument();
    expect(screen.getByText("Warning content")).toBeInTheDocument();
  });

  it("renders an error correctly", () => {
    render(<Alert type="error" title="Error title" message="Error content" />);

    expect(screen.getByText("Error: Error title")).toBeInTheDocument();
    expect(screen.getByText("Error content")).toBeInTheDocument();
  });

  it("renders actions correctly", () => {
    render(
      <Alert
        type="error"
        title="Error title"
        message="Error content"
        actions={<>My actions content</>}
      />,
    );

    expect(screen.getByText("My actions content")).toBeInTheDocument();
  });
});
