import { act, render as reactRender, screen } from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { ModelEditor } from "../ModelEditor";
import { createMockModelEditorViewState } from "../../../../test/factories/model-editor/view-state";
import { userEvent } from "@testing-library/user-event";

describe(ModelEditor.name, () => {
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

  const viewState = createMockModelEditorViewState();

  const render = () =>
    reactRender(
      <ModelEditor
        initialViewState={viewState}
        initialMethods={[method1, method2, method3]}
      />,
    );

  it("renders Save button when no rows are selected", () => {
    render();

    expect(screen.getByText("Save all")).toBeInTheDocument();
  });

  it("renders Save button when rows are selected", async () => {
    render();

    await act(async () => {
      await userEvent.click(screen.getAllByLabelText("Expand")[0]);
    });

    await act(async () => {
      await userEvent.click(screen.getAllByTestId("modelable-method-row")[0]);
    });

    // The top-level Save button and the per-library Save button should have been updated.
    expect(screen.getAllByText("Save selected")).toHaveLength(2);
  });
});
