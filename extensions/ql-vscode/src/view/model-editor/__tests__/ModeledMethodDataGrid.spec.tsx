import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { InProgressMethods } from "../../../model-editor/shared/in-progress-methods";
import { Mode } from "../../../model-editor/shared/mode";
import {
  ModeledMethodDataGrid,
  ModeledMethodDataGridProps,
} from "../ModeledMethodDataGrid";

describe(ModeledMethodDataGrid.name, () => {
  const method1 = createMethod({
    library: "sql2o",
    libraryVersion: "1.6.0",
    signature: "org.sql2o.Connection#createQuery(String)",
    packageName: "org.sql2o",
    typeName: "Connection",
    methodName: "createQuery",
    methodParameters: "(String)",
    supported: false,
  });
  const method2 = createMethod({
    library: "sql2o",
    libraryVersion: "1.6.0",
    signature: "org.sql2o.Query#executeScalar(Class)",
    packageName: "org.sql2o",
    typeName: "Query",
    methodName: "executeScalar",
    methodParameters: "(Class)",
    supported: false,
  });
  const method3 = createMethod({
    library: "sql2o",
    libraryVersion: "1.6.0",
    signature: "org.sql2o.Sql2o#open()",
    packageName: "org.sql2o",
    typeName: "Sql2o",
    methodName: "open",
    methodParameters: "()",
    supported: true,
  });
  const onChange = jest.fn();

  const render = (props: Partial<ModeledMethodDataGridProps> = {}) =>
    reactRender(
      <ModeledMethodDataGrid
        packageName="sql2o"
        methods={[method1, method2, method3]}
        modeledMethods={{
          [method1.signature]: {
            ...method1,
            type: "sink",
            input: "Argument[0]",
            output: "",
            kind: "jndi-injection",
            provenance: "df-generated",
          },
        }}
        modifiedSignatures={new Set([method1.signature])}
        inProgressMethods={new InProgressMethods()}
        mode={Mode.Application}
        hideModeledMethods={false}
        revealedMethodSignature={null}
        onChange={onChange}
        {...props}
      />,
    );

  it("renders the modeled and unmodeled rows", () => {
    render();

    expect(screen.getAllByTestId("modelable-method-row")).toHaveLength(2);
    expect(screen.queryByTestId("unmodelable-method-row")).toBeInTheDocument();
  });

  it("renders the modeled rows when hideModeledMethods is set", () => {
    render({
      hideModeledMethods: true,
    });

    expect(screen.getAllByTestId("modelable-method-row")).toHaveLength(2);
    expect(
      screen.queryByTestId("unmodelable-method-row"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("And 1 method modeled in other CodeQL packs"),
    ).toBeInTheDocument();
  });

  it("does not render rows when no methods are modelable", () => {
    render({
      methods: [method3],
      modifiedSignatures: new Set(),
      hideModeledMethods: true,
    });

    expect(
      screen.queryByTestId("modelable-method-row"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("unmodelable-method-row"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("1 method modeled in other CodeQL packs"),
    ).toBeInTheDocument();
  });
});
