import { render, screen } from "@testing-library/react";
import { ModelKindDropdown } from "../ModelKindDropdown";
import { userEvent } from "@testing-library/user-event";
import {
  createNoneModeledMethod,
  createSinkModeledMethod,
  createSourceModeledMethod,
} from "../../../../test/factories/model-editor/modeled-method-factories";
import { QueryLanguage } from "../../../common/query-language";

describe(ModelKindDropdown.name, () => {
  const onChange = jest.fn();

  beforeEach(() => {
    onChange.mockReset();
  });

  it("allows changing the kind", async () => {
    const modeledMethod = createSourceModeledMethod({
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
    const modeledMethod = createSourceModeledMethod({
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
    const updatedModeledMethod = createSinkModeledMethod({
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
    const modeledMethod = createSourceModeledMethod({
      type: "source",
      kind: undefined,
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
    const modeledMethod = createNoneModeledMethod();

    render(
      <ModelKindDropdown
        language={QueryLanguage.Java}
        modeledMethod={modeledMethod}
        onChange={onChange}
      />,
    );

    expect(onChange).not.toHaveBeenCalled();
  });
});
