import * as React from "react";
import { render, screen } from "@testing-library/react";
import { ModelKindDropdown } from "../ModelKindDropdown";
import userEvent from "@testing-library/user-event";
import { createModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";
import { QueryLanguage } from "../../../common/query-language";

describe(ModelKindDropdown.name, () => {
  const onChange = jest.fn();

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
        language={QueryLanguage.Java}
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
    const modeledMethod = createModeledMethod({
      type: "source",
      kind: "local",
    });

    const { rerender } = render(
      <ModelKindDropdown
        language={QueryLanguage.Java}
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
        language={QueryLanguage.Java}
        modeledMethod={updatedModeledMethod}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue("code-injection");
  });

  it("sets the kind when value is undefined", () => {
    const modeledMethod = createModeledMethod({
      type: "source",
    });

    render(
      <ModelKindDropdown
        language={QueryLanguage.Java}
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

  it("does not call onChange when unmodeled and the kind is valid", () => {
    const modeledMethod = createModeledMethod({
      type: "none",
      kind: "",
    });

    render(
      <ModelKindDropdown
        language={QueryLanguage.Java}
        modeledMethod={modeledMethod}
        onChange={onChange}
      />,
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onChange when unmodeled and the kind is valid", () => {
    const modeledMethod = createModeledMethod({
      type: "none",
      kind: "local",
    });

    render(
      <ModelKindDropdown
        language={QueryLanguage.Java}
        modeledMethod={modeledMethod}
        onChange={onChange}
      />,
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "",
      }),
    );
  });
});
