import * as React from "react";
import { render, screen } from "@testing-library/react";
import { ModelKindDropdown } from "../ModelKindDropdown";
import userEvent from "@testing-library/user-event";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { createModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";

describe(ModelKindDropdown.name, () => {
  const onChange = jest.fn();
  const method = createMethod();

  beforeEach(() => {
    onChange.mockReset();
  });

  it("allows changing the kind", async () => {
    const modeledMethod = createModeledMethod({
      type: "source",
      kind: "local",
    });

    render(
      <ModelKindDropdown
        method={method}
        modeledMethod={modeledMethod}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue("local");
    await userEvent.selectOptions(screen.getByRole("combobox"), "remote");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "remote",
      }),
    );
  });

  it("resets the kind when changing the supported kinds", () => {
    const method = createMethod();
    const modeledMethod = createModeledMethod({
      type: "source",
      kind: "local",
    });

    const { rerender } = render(
      <ModelKindDropdown
        method={method}
        modeledMethod={modeledMethod}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue("local");
    expect(onChange).not.toHaveBeenCalled();

    // Changing the type to sink should update the supported kinds
    const updatedModeledMethod = createModeledMethod({
      type: "sink",
      kind: "local",
    });

    rerender(
      <ModelKindDropdown
        method={method}
        modeledMethod={updatedModeledMethod}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue("code-injection");
  });

  it("sets the kind when value is undefined", () => {
    const method = createMethod();
    const modeledMethod = createModeledMethod({
      type: "source",
    });

    render(
      <ModelKindDropdown
        method={method}
        modeledMethod={modeledMethod}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue("local");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "local",
      }),
    );
  });
});
