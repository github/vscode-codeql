import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MethodModelingInputs,
  MethodModelingInputsProps,
} from "../MethodModelingInputs";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { createModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";

describe(MethodModelingInputs.name, () => {
  const render = (props: MethodModelingInputsProps) =>
    reactRender(<MethodModelingInputs {...props} />);

  const method = createMethod();
  const modeledMethod = createModeledMethod();
  const onChange = jest.fn();

  it("renders the method modeling inputs", () => {
    render({
      method,
      modeledMethod,
      onChange,
    });

    // Check that all the labels are rendered.
    expect(screen.getByText("Model Type")).toBeInTheDocument();
    expect(screen.getByText("Input")).toBeInTheDocument();
    expect(screen.getByText("Output")).toBeInTheDocument();
    expect(screen.getByText("Kind")).toBeInTheDocument();

    // Check that all the dropdowns are rendered.
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBe(4);
    const modelTypeDropdown = screen.getByRole("combobox", {
      name: "Model type",
    });
    expect(modelTypeDropdown).toHaveValue("sink");
    const modelTypeOptions = modelTypeDropdown.querySelectorAll("option");
    expect(modelTypeOptions.length).toBe(5);
  });

  it("allows changing the type", async () => {
    render({
      method,
      modeledMethod,
      onChange,
    });

    const modelTypeDropdown = screen.getByRole("combobox", {
      name: "Model type",
    });

    await userEvent.selectOptions(modelTypeDropdown, "source");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "source",
      }),
    );
  });

  it("sets other dropdowns when model type is changed", () => {
    const { rerender } = render({
      method,
      modeledMethod,
      onChange,
    });

    const updatedModeledMethod = createModeledMethod({
      type: "source",
    });

    rerender(
      <MethodModelingInputs
        method={method}
        modeledMethod={updatedModeledMethod}
        onChange={onChange}
      />,
    );

    const modelTypeDropdown = screen.getByRole("combobox", {
      name: "Model type",
    });
    const modelInputDropdown = screen.getByRole("combobox", {
      name: "Input",
    });
    const modelOutputDropdown = screen.getByRole("combobox", {
      name: "Output",
    });
    const modelKindDropdown = screen.getByRole("combobox", {
      name: "Kind",
    });

    expect(modelTypeDropdown).toHaveValue("source");
    expect(modelInputDropdown).toHaveValue("-");
    expect(modelOutputDropdown).toHaveValue("ReturnValue");
    expect(modelKindDropdown).toHaveValue("local");
  });
});
