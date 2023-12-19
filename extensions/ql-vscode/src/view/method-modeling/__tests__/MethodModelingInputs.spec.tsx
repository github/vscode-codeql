import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
  MethodModelingInputs,
  MethodModelingInputsProps,
} from "../MethodModelingInputs";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import {
  createMethodSignature,
  createSinkModeledMethod,
} from "../../../../test/factories/model-editor/modeled-method-factories";
import { QueryLanguage } from "../../../common/query-language";
import { createEmptyModeledMethod } from "../../../model-editor/modeled-method-empty";

describe(MethodModelingInputs.name, () => {
  const render = (props: MethodModelingInputsProps) =>
    reactRender(<MethodModelingInputs {...props} />);

  const language = QueryLanguage.Java;
  const method = createMethod();
  const modeledMethod = createSinkModeledMethod();
  const modelingStatus = "unmodeled";
  const isModelingInProgress = false;
  const onChange = jest.fn();

  it("renders the method modeling inputs", () => {
    render({
      language,
      method,
      modeledMethod,
      modelingStatus,
      isModelingInProgress,
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
      language,
      method,
      modeledMethod,
      modelingStatus,
      isModelingInProgress,
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
      language,
      method,
      modeledMethod,
      modelingStatus,
      isModelingInProgress,
      onChange,
    });

    const updatedModeledMethod = createEmptyModeledMethod(
      "source",
      createMethodSignature(),
    );

    rerender(
      <MethodModelingInputs
        language={language}
        method={method}
        modeledMethod={updatedModeledMethod}
        modelingStatus={modelingStatus}
        isModelingInProgress={isModelingInProgress}
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

  it("sets in progress dropdowns when modeling is in progress", () => {
    render({
      language,
      method,
      modeledMethod,
      modelingStatus,
      isModelingInProgress: true,
      onChange,
    });

    // Check that all the labels are rendered.
    expect(screen.getByText("Model Type")).toBeInTheDocument();
    expect(screen.getByText("Input")).toBeInTheDocument();
    expect(screen.getByText("Output")).toBeInTheDocument();
    expect(screen.getByText("Kind")).toBeInTheDocument();

    // Check that all the dropdowns are rendered.
    const dropdowns = screen.getAllByRole("combobox");
    expect(dropdowns.length).toBe(4);

    // Check that all the dropdowns are disabled and indicate have the value "Thinking...".
    dropdowns.forEach((dropdown) => {
      expect(dropdown).toBeDisabled();
      expect(dropdown).toHaveValue("Thinking...");
    });
  });
});
