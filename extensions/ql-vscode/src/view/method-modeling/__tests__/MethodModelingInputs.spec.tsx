import { render as reactRender, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { MethodModelingInputsProps } from "../MethodModelingInputs";
import { MethodModelingInputs } from "../MethodModelingInputs";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import {
  createMethodSignature,
  createSinkModeledMethod,
} from "../../../../test/factories/model-editor/modeled-method-factories";
import { QueryLanguage } from "../../../common/query-language";
import { createEmptyModeledMethod } from "../../../model-editor/modeled-method-empty";
import { defaultModelConfig } from "../../../model-editor/languages";

describe(MethodModelingInputs.name, () => {
  const render = (props: MethodModelingInputsProps) =>
    reactRender(<MethodModelingInputs {...props} />);

  const language = QueryLanguage.Java;
  const method = createMethod();
  const modeledMethod = createSinkModeledMethod();
  const modelConfig = defaultModelConfig;
  const onChange = jest.fn();

  it("renders the method modeling inputs", () => {
    render({
      language,
      method,
      modeledMethod,
      modelConfig,
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
      modelConfig,
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
      modelConfig,
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
        modelConfig={modelConfig}
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
