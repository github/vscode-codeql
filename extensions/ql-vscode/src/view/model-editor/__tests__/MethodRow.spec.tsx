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

  const render = (props: Partial<MethodRowProps> = {}) =>
    reactRender(
      <MethodRow
        method={method}
        methodCanBeModeled={true}
        modeledMethod={modeledMethod}
        methodIsUnsaved={false}
        modelingInProgress={false}
        mode={Mode.Application}
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

  it("can change the kind", async () => {
    render();

    onChange.mockReset();

    expect(screen.getByRole("combobox", { name: "Kind" })).toHaveValue("taint");

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Kind" }),
      "value",
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      ...modeledMethod,
      kind: "value",
    });
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
      modeledMethod: undefined,
    });

    expect(screen.getByLabelText("Method not modeled")).toBeInTheDocument();
  });

  it("shows the in progress indicator when in progress", () => {
    render({
      modelingInProgress: true,
    });

    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("renders an unmodelable method", () => {
    render({
      methodCanBeModeled: false,
      modeledMethod: undefined,
    });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Method already modeled")).toBeInTheDocument();
  });
});
