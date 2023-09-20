import * as React from "react";
import { render, screen } from "@testing-library/react";
import { ModelKindDropdown } from "../ModelKindDropdown";
import userEvent from "@testing-library/user-event";

describe(ModelKindDropdown.name, () => {
  const onChange = jest.fn();

  beforeEach(() => {
    onChange.mockReset();
  });

  it("allows changing the kind", async () => {
    render(
      <ModelKindDropdown
        kinds={["local", "remote"]}
        value="local"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue("local");
    await userEvent.selectOptions(screen.getByRole("combobox"), "remote");
    expect(onChange).toHaveBeenCalledWith("remote");
  });

  it("resets the kind when changing the supported kinds", () => {
    const { rerender } = render(
      <ModelKindDropdown
        kinds={["local", "remote"]}
        value={"local"}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue("local");
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <ModelKindDropdown
        kinds={["sql-injection", "log-injection", "url-redirection"]}
        value="local"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("sql-injection");
    expect(onChange).toHaveBeenCalledWith("sql-injection");
  });

  it("sets the kind when value is undefined", () => {
    render(
      <ModelKindDropdown
        kinds={["local", "remote"]}
        value={undefined}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue("local");
    expect(onChange).toHaveBeenCalledWith("local");
  });
});
