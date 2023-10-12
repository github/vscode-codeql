import * as React from "react";
import {
  getAllByRole,
  render as reactRender,
  screen,
} from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { Mode } from "../../../model-editor/shared/mode";
import { MethodRow, MethodRowProps } from "../MethodRow";
import { ModeledMethod } from "../../../model-editor/modeled-method";
import userEvent from "@testing-library/user-event";
import { ModelEditorViewState } from "../../../model-editor/shared/view-state";
import { createMockExtensionPack } from "../../../../test/factories/model-editor/extension-pack";

describe(MethodRow.name, () => {
  const method = createMethod({
    library: "sql2o",
    libraryVersion: "1.6.0",
    signature: "org.sql2o.Connection#createQuery(String)",
    packageName: "org.sql2o",
    typeName: "Connection",
    methodName: "createQuery",
    methodParameters: "(String)",
    supported: false,
  });
  const modeledMethod: ModeledMethod = {
    ...method,
    type: "summary",
    input: "Argument[0]",
    output: "ReturnValue",
    kind: "taint",
    provenance: "df-generated",
  };
  const onChange = jest.fn();

  const viewState: ModelEditorViewState = {
    mode: Mode.Application,
    showFlowGeneration: false,
    showLlmButton: false,
    showMultipleModels: false,
    extensionPack: createMockExtensionPack(),
    sourceArchiveAvailable: true,
  };

  const render = (props: Partial<MethodRowProps> = {}) =>
    reactRender(
      <MethodRow
        method={method}
        methodCanBeModeled={true}
        modeledMethods={[modeledMethod]}
        methodIsUnsaved={false}
        modelingInProgress={false}
        revealedMethodSignature={null}
        viewState={viewState}
        onChange={onChange}
        {...props}
      />,
    );

  it("renders a modelable method", () => {
    render();

    expect(screen.queryAllByRole("combobox")).toHaveLength(4);
    expect(screen.getByLabelText("Method modeled")).toBeInTheDocument();
    expect(screen.queryByLabelText("Loading")).not.toBeInTheDocument();
  });

  it("renders when there is no modeled method", () => {
    render({ modeledMethods: [] });

    expect(screen.queryAllByRole("combobox")).toHaveLength(4);
    expect(screen.getByLabelText("Method not modeled")).toBeInTheDocument();
    expect(screen.queryByLabelText("Loading")).not.toBeInTheDocument();
  });

  it("can change the type when there is no modeled method", async () => {
    render({ modeledMethods: [] });

    onChange.mockReset();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Model type" }),
      "source",
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(method.signature, [
      {
        type: "source",
        input: "Argument[0]",
        output: "ReturnValue",
        kind: "value",
        provenance: "manual",
        signature: method.signature,
        packageName: method.packageName,
        typeName: method.typeName,
        methodName: method.methodName,
        methodParameters: method.methodParameters,
      },
    ]);
  });

  it("can change the kind", async () => {
    render();

    onChange.mockReset();

    expect(screen.getByRole("combobox", { name: "Kind" })).toHaveValue("taint");

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Kind" }),
      "value",
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(method.signature, [
      {
        ...modeledMethod,
        kind: "value",
      },
    ]);
  });

  it("has the correct input options", () => {
    render();

    const inputDropdown = screen.getByRole("combobox", { name: "Input" });
    expect(inputDropdown).toHaveValue("Argument[0]");

    const options = getAllByRole(inputDropdown, "option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Argument[this]");
    expect(options[1]).toHaveTextContent("Argument[0]");
  });

  it("has the correct output options", () => {
    render();

    const inputDropdown = screen.getByRole("combobox", { name: "Output" });
    expect(inputDropdown).toHaveValue("ReturnValue");

    const options = getAllByRole(inputDropdown, "option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("ReturnValue");
    expect(options[1]).toHaveTextContent("Argument[this]");
    expect(options[2]).toHaveTextContent("Argument[0]");
  });

  it("shows the modeling status indicator when unsaved", () => {
    render({
      methodIsUnsaved: true,
    });

    expect(
      screen.getByLabelText("Changes have not been saved"),
    ).toBeInTheDocument();
  });

  it("shows the modeling status indicator when unmodeled", () => {
    render({
      modeledMethods: [],
    });

    expect(screen.getByLabelText("Method not modeled")).toBeInTheDocument();
  });

  it("shows the in progress indicator when in progress", () => {
    render({
      modelingInProgress: true,
    });

    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("can render multiple models", () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "sink" },
        { ...modeledMethod, type: "summary" },
      ],
      viewState: {
        ...viewState,
        showMultipleModels: true,
      },
    });

    const kindInputs = screen.getAllByRole("combobox", { name: "Model type" });
    expect(kindInputs).toHaveLength(3);
    expect(kindInputs[0]).toHaveValue("source");
    expect(kindInputs[1]).toHaveValue("sink");
    expect(kindInputs[2]).toHaveValue("summary");
  });

  it("renders only first model when showMultipleModels feature flag is disabled", () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "sink" },
        { ...modeledMethod, type: "summary" },
      ],
      viewState: {
        ...viewState,
        showMultipleModels: false,
      },
    });

    const kindInputs = screen.getAllByRole("combobox", { name: "Model type" });
    expect(kindInputs.length).toBe(1);
    expect(kindInputs[0]).toHaveValue("source");
  });

  it("can update fields when there are multiple models", async () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "sink", kind: "code-injection" },
        { ...modeledMethod, type: "summary" },
      ],
      viewState: {
        ...viewState,
        showMultipleModels: true,
      },
    });

    onChange.mockReset();

    expect(screen.getAllByRole("combobox", { name: "Kind" })[1]).toHaveValue(
      "code-injection",
    );

    await userEvent.selectOptions(
      screen.getAllByRole("combobox", { name: "Kind" })[1],
      "sql-injection",
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(method.signature, [
      { ...modeledMethod, type: "source" },
      { ...modeledMethod, type: "sink", kind: "sql-injection" },
      { ...modeledMethod, type: "summary" },
    ]);
  });

  it("renders an unmodelable method", () => {
    render({
      methodCanBeModeled: false,
      modeledMethods: [],
    });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Method already modeled")).toBeInTheDocument();
  });

  it("Doesn't show add/remove buttons when multiple methods feature flag is disabled", async () => {
    render({
      modeledMethods: [modeledMethod],
      viewState: {
        ...viewState,
        showMultipleModels: false,
      },
    });

    expect(screen.queryByLabelText("Add new model")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remove model")).not.toBeInTheDocument();
  });

  it("Button to add new model is disabled when there are no modeled methods", async () => {
    render({
      modeledMethods: [],
      viewState: {
        ...viewState,
        showMultipleModels: true,
      },
    });

    const addButton = screen.queryByLabelText("Add new model");
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeDisabled();

    expect(screen.queryByLabelText("Remove model")).not.toBeInTheDocument();
  });

  it("Button to add new model is disabled when there is one unmodeled method", async () => {
    render({
      modeledMethods: [{ ...modeledMethod, type: "none" }],
      viewState: {
        ...viewState,
        showMultipleModels: true,
      },
    });

    const addButton = screen.queryByLabelText("Add new model");
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeDisabled();

    expect(screen.queryByLabelText("Remove model")).not.toBeInTheDocument();
  });

  it("Add button is shown and enabed when there is one modeled methods", async () => {
    render({
      modeledMethods: [modeledMethod],
      viewState: {
        ...viewState,
        showMultipleModels: true,
      },
    });

    const addButton = screen.queryByLabelText("Add new model");
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeEnabled();

    expect(screen.queryByLabelText("Remove model")).not.toBeInTheDocument();
  });

  it("Add and remove buttons are shown and enabed when there are multiple modeled methods", async () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "none" },
      ],
      viewState: {
        ...viewState,
        showMultipleModels: true,
      },
    });

    const addButton = screen.queryByLabelText("Add new model");
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeEnabled();

    const removeButton = screen.queryByLabelText("Remove model");
    expect(removeButton).toBeInTheDocument();
    expect(removeButton).toBeEnabled();
  });

  it("Shows add button on last row and remove button on all other rows", async () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "sink" },
        { ...modeledMethod, type: "summary" },
        { ...modeledMethod, type: "none" },
      ],
      viewState: {
        ...viewState,
        showMultipleModels: true,
      },
    });

    const addButtons = screen.queryAllByLabelText("Add new model");
    expect(addButtons.length).toBe(1);
    expect(addButtons[0]).toBeEnabled();

    const removeButtons = screen.queryAllByLabelText("Remove model");
    expect(removeButtons.length).toBe(3);
    for (const removeButton of removeButtons) {
      expect(removeButton).toBeEnabled();
    }
  });
});
