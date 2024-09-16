import {
  getAllByRole,
  render as reactRender,
  screen,
} from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import type { MethodRowProps } from "../MethodRow";
import { MethodRow } from "../MethodRow";
import type { ModeledMethod } from "../../../model-editor/modeled-method";
import { userEvent } from "@testing-library/user-event";
import { createMockModelEditorViewState } from "../../../../test/factories/model-editor/view-state";

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
    provenance: "manual",
  };
  const onChange = jest.fn();
  const onMethodClick = jest.fn();

  const viewState = createMockModelEditorViewState();

  const render = (props: Partial<MethodRowProps> = {}) =>
    reactRender(
      <MethodRow
        method={method}
        methodCanBeModeled={true}
        modeledMethods={[modeledMethod]}
        methodIsUnsaved={false}
        methodIsSelected={false}
        revealedMethodSignature={null}
        evaluationRun={undefined}
        viewState={viewState}
        onChange={onChange}
        onMethodClick={onMethodClick}
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
        output: "ReturnValue",
        kind: "value",
        provenance: "manual",
        signature: method.signature,
        endpointType: method.endpointType,
        packageName: method.packageName,
        typeName: method.typeName,
        methodName: method.methodName,
        methodParameters: method.methodParameters,
      },
    ] satisfies ModeledMethod[]);
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
    ] satisfies ModeledMethod[]);
  });

  it("changes the provenance when the kind is changed", async () => {
    const modeledMethodWithGeneratedProvenance: ModeledMethod = {
      ...modeledMethod,
      provenance: "df-generated",
    };
    render({ modeledMethods: [modeledMethodWithGeneratedProvenance] });

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
        provenance: "df-manual",
      },
    ] satisfies ModeledMethod[]);
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

  it("can render multiple models", () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "sink" },
        { ...modeledMethod, type: "summary" },
      ],
    });

    const kindInputs = screen.getAllByRole("combobox", { name: "Model type" });
    expect(kindInputs).toHaveLength(3);
    expect(kindInputs[0]).toHaveValue("source");
    expect(kindInputs[1]).toHaveValue("sink");
    expect(kindInputs[2]).toHaveValue("summary");
  });

  it("can update fields when there are multiple models", async () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "sink", kind: "code-injection" },
        { ...modeledMethod, type: "summary" },
      ],
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
    ] satisfies ModeledMethod[]);
  });

  it("renders an unmodelable method", () => {
    render({
      methodCanBeModeled: false,
      modeledMethods: [],
    });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Method already modeled")).toBeInTheDocument();
  });

  it("shows disabled button add new model when there are no modeled methods", async () => {
    render({
      modeledMethods: [],
    });

    const addButton = screen.queryByLabelText("Add new model");
    expect(addButton).toBeInTheDocument();
    expect(addButton?.getElementsByTagName("input")[0]).toBeDisabled();

    expect(screen.queryByLabelText("Remove model")).not.toBeInTheDocument();
  });

  it("disabled button to add new model when there is one unmodeled method", async () => {
    render({
      modeledMethods: [{ ...modeledMethod, type: "none" }],
    });

    const addButton = screen.queryByLabelText("Add new model");
    expect(addButton).toBeInTheDocument();
    expect(addButton?.getElementsByTagName("input")[0]).toBeDisabled();

    expect(screen.queryByLabelText("Remove model")).not.toBeInTheDocument();
  });

  it("enabled button to add new model when there is one modeled method", async () => {
    render({
      modeledMethods: [modeledMethod],
    });

    const addButton = screen.queryByLabelText("Add new model");
    expect(addButton).toBeInTheDocument();
    expect(addButton?.getElementsByTagName("input")[0]).toBeEnabled();

    expect(screen.queryByLabelText("Remove model")).not.toBeInTheDocument();
  });

  it("enabled add/remove model buttons when there are multiple modeled methods", async () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "none" },
      ],
    });

    const addButton = screen.queryByLabelText("Add new model");
    expect(addButton).toBeInTheDocument();
    expect(addButton?.getElementsByTagName("input")[0]).toBeEnabled();

    const removeButton = screen.queryByLabelText("Remove model");
    expect(removeButton).toBeInTheDocument();
    expect(removeButton?.getElementsByTagName("input")[0]).toBeEnabled();
  });

  it("shows add model button on first row and remove model button on all other rows", async () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "sink" },
        { ...modeledMethod, type: "summary" },
        { ...modeledMethod, type: "none" },
      ],
    });

    const addButtons = screen.queryAllByLabelText("Add new model");
    expect(addButtons.length).toBe(1);
    expect(addButtons[0]?.getElementsByTagName("input")[0]).toBeEnabled();

    const removeButtons = screen.queryAllByLabelText("Remove model");
    expect(removeButtons.length).toBe(3);
    for (const removeButton of removeButtons) {
      expect(removeButton?.getElementsByTagName("input")[0]).toBeEnabled();
    }
  });

  it("can add a new model", async () => {
    render({
      modeledMethods: [modeledMethod],
    });

    onChange.mockReset();
    await userEvent.click(screen.getByLabelText("Add new model"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(method.signature, [
      modeledMethod,
      {
        type: "none",
        signature: method.signature,
        endpointType: method.endpointType,
        packageName: method.packageName,
        typeName: method.typeName,
        methodName: method.methodName,
        methodParameters: method.methodParameters,
      },
    ] satisfies ModeledMethod[]);
  });

  it("cannot delete the first modeled method (but delete second instead)", async () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "sink" },
        { ...modeledMethod, type: "none" },
        { ...modeledMethod, type: "summary" },
      ],
    });

    onChange.mockReset();
    await userEvent.click(screen.getAllByLabelText("Remove model")[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(method.signature, [
      { ...modeledMethod, type: "source" },
      { ...modeledMethod, type: "none" },
      { ...modeledMethod, type: "summary" },
    ] satisfies ModeledMethod[]);
  });

  it("can delete a modeled method in the middle", async () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "sink" },
        { ...modeledMethod, type: "none" },
        { ...modeledMethod, type: "summary" },
      ],
    });

    onChange.mockReset();
    await userEvent.click(screen.getAllByLabelText("Remove model")[1]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(method.signature, [
      { ...modeledMethod, type: "source" },
      { ...modeledMethod, type: "sink" },
      { ...modeledMethod, type: "summary" },
    ] satisfies ModeledMethod[]);
  });

  it("does not display validation errors when everything is valid", () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "sink" },
      ],
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("displays a single validation error", () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "source" },
      ],
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("Error: Duplicated classification"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Error: Conflicting classification"),
    ).not.toBeInTheDocument();
  });

  it("displays multiple validation errors", () => {
    render({
      modeledMethods: [
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "source" },
        { ...modeledMethod, type: "neutral", kind: "source" },
      ],
    });

    expect(screen.getAllByRole("alert").length).toBe(2);
    expect(
      screen.getByText("Error: Duplicated classification"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Error: Conflicting classification"),
    ).toBeInTheDocument();
  });
});
